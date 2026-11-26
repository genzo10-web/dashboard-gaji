import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  update
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCIp7k54mYvcwu-LjEEVbv52zZNSmsQezU",
  authDomain: "keuangan-bersama-8abcb.firebaseapp.com",
  databaseURL: "https://keuangan-bersama-8abcb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "keuangan-bersama-8abcb",
  storageBucket: "keuangan-bersama-8abcb.firebasestorage.app",
  messagingSenderId: "908143622931",
  appId: "1:908143622931:web:97465434421453a65c38e6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY_ANDA",
  authDomain: "GANTI_DENGAN_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://GANTI_DENGAN_DATABASE_URL_ANDA.firebasedatabase.app",
  projectId: "GANTI_DENGAN_PROJECT_ID",
  storageBucket: "GANTI_DENGAN_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID",
  appId: "GANTI_DENGAN_APP_ID"
};
// =========================================================================

const LEGACY_STORAGE_KEY = "SALARY_CASHFLOW_DB_V1";
const ROOM_PIN_STORAGE_KEY = "SHARED_FINANCE_ROOM_PIN";
const PROFILES = ["Mas Gigih", "Mba Bela Cintaqu", "Dana Bersama"];

let transactions = [];
let expenseChartInstance = null;
let currentRoomPin = localStorage.getItem(ROOM_PIN_STORAGE_KEY) || "";
let unsubscribeListener = null;

// Elemen DOM
const roomGateSection = document.getElementById("roomGateSection");
const dashboardMain = document.getElementById("dashboardMain");
const syncStatusBadge = document.getElementById("syncStatusBadge");
const configWarning = document.getElementById("configWarning");

const roomForm = document.getElementById("roomForm");
const inputRoomCode = document.getElementById("inputRoomCode");
const btnChangeRoom = document.getElementById("btnChangeRoom");

const migrationBanner = document.getElementById("migrationBanner");
const btnMigrateData = document.getElementById("btnMigrateData");
const btnDismissMigration = document.getElementById("btnDismissMigration");

const formIncome = document.getElementById("formIncome");
const formExpense = document.getElementById("formExpense");
const filterMonthInput = document.getElementById("filterMonth");
const filterOwnerInput = document.getElementById("filterOwner");

const profileProgressGrid = document.getElementById("profileProgressGrid");
const incomeTableBody = document.getElementById("incomeTableBody");
const expenseTableBody = document.getElementById("expenseTableBody");

// Cek apakah firebaseConfig sudah diisi oleh pengguna
const isFirebaseConfigured =
  firebaseConfig.apiKey !== "GANTI_DENGAN_API_KEY_ANDA" &&
  firebaseConfig.databaseURL.startsWith("https://");

let db = null;
if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
} else {
  configWarning.classList.remove("hidden");
}

const formatIDR = (number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(number);
};

const initDefaultDates = () => {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("inDate").value = today;
  document.getElementById("exDate").value = today;
  filterMonthInput.value = today.slice(0, 7);
};

const sanitizeRoomCode = (raw) => {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
};

const normalizeOwner = (owner) => {
  if (!owner) return "Mas Gigih";
  if (owner === "Pasangan") return "Mba Bela Cintaqu";
  return owner;
};

const getOwnerBadgeClass = (owner) => {
  if (owner === "Mba Bela Cintaqu") return "pill pill-pasangan";
  if (owner === "Dana Bersama") return "pill pill-bersama";
  return "pill pill-gigih";
};

const getProfileBorderClass = (owner) => {
  if (owner === "Mba Bela Cintaqu") return "border-bela";
  if (owner === "Dana Bersama") return "border-bersama";
  return "border-gigih";
};

// Cek apakah masih ada data lama di localStorage untuk ditawari pindah ke Cloud
const checkLegacyData = () => {
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return;
  try {
    const parsed = JSON.parse(legacyRaw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      migrationBanner.classList.remove("hidden");
    }
  } catch {
    // Abaikan jika JSON lama rusak
  }
};

// Hubungkan Listener Real-Time ke Firebase
const connectToRoom = (pin) => {
  if (!isFirebaseConfigured || !db) {
    alert("Isi dulu firebaseConfig di file app.js sebelum menghubungkan ruang.");
    return;
  }

  const cleanPin = sanitizeRoomCode(pin);
  if (cleanPin.length < 6) {
    alert("Kode Ruang harus minimal 6 karakter (huruf, angka, atau tanda hubung).");
    return;
  }

  currentRoomPin = cleanPin;
  localStorage.setItem(ROOM_PIN_STORAGE_KEY, cleanPin);

  if (unsubscribeListener) {
    unsubscribeListener();
  }

  roomGateSection.classList.add("hidden");
  dashboardMain.classList.remove("hidden");
  syncStatusBadge.textContent = "Menghubungkan...";
  syncStatusBadge.className = "sync-badge sync-offline";

  const roomTxnsRef = ref(db, `rooms/${currentRoomPin}/transactions`);

  unsubscribeListener = onValue(
    roomTxnsRef,
    (snapshot) => {
      const dataObj = snapshot.val();
      transactions = dataObj ? Object.values(dataObj) : [];

      syncStatusBadge.textContent = `Tersinkronisasi (${currentRoomPin})`;
      syncStatusBadge.className = "sync-badge sync-online";

      renderDashboard();
      checkLegacyData();
    },
    (error) => {
      console.error("Firebase Sync Error:", error);
      syncStatusBadge.textContent = "Gagal Terhubung";
      syncStatusBadge.className = "sync-badge sync-offline";
      alert("Gagal menyinkronkan ke Firebase. Pastikan databaseURL dan Rules sudah benar.");
    }
  );
};

// Render 3 Kartu Perbandingan Progres
const renderProfileProgress = (monthTransactions) => {
  profileProgressGrid.innerHTML = "";

  PROFILES.forEach((profileName) => {
    const profileTxns = monthTransactions.filter(
      (item) => normalizeOwner(item.owner) === profileName
    );

    const income = profileTxns
      .filter((item) => item.type === "income")
      .reduce((acc, item) => acc + item.amount, 0);

    const expense = profileTxns
      .filter((item) => item.type === "expense")
      .reduce((acc, item) => acc + item.amount, 0);

    const balance = income - expense;
    const savingRate = income > 0 ? ((balance / income) * 100).toFixed(1) : "0.0";

    let usagePercent = 0;
    if (income > 0) {
      usagePercent = Math.min((expense / income) * 100, 100);
    } else if (expense > 0) {
      usagePercent = 100;
    }

    let fillClass = "fill-safe";
    if (usagePercent > 90) fillClass = "fill-danger";
    else if (usagePercent > 70) fillClass = "fill-warn";

    const card = document.createElement("article");
    card.className = `profile-card ${getProfileBorderClass(profileName)}`;

    const topRow = document.createElement("div");
    topRow.className = "profile-top";

    const nameBadge = document.createElement("span");
    nameBadge.className = getOwnerBadgeClass(profileName);
    nameBadge.textContent = profileName;

    const focusBtn = document.createElement("button");
    focusBtn.type = "button";
    focusBtn.className = "btn-focus";
    const isFocused = filterOwnerInput.value === profileName;
    focusBtn.textContent = isFocused ? "Tampilkan Semua" : "Fokus Detail";
    focusBtn.onclick = () => {
      filterOwnerInput.value = isFocused ? "ALL" : profileName;
      renderDashboard();
      if (!isFocused) {
        document.getElementById("tablesAnchor").scrollIntoView({ behavior: "smooth" });
      }
    };

    topRow.append(nameBadge, focusBtn);

    const metricsGrid = document.createElement("div");
    metricsGrid.className = "profile-metrics";

    const createMetric = (label, valueText, colorClass = "") => {
      const box = document.createElement("div");
      box.className = "metric-item";
      const lbl = document.createElement("span");
      lbl.className = "metric-label";
      lbl.textContent = label;
      const val = document.createElement("span");
      val.className = `metric-val ${colorClass}`;
      val.textContent = valueText;
      box.append(lbl, val);
      return box;
    };

    metricsGrid.append(
      createMetric("Masuk", formatIDR(income), "income"),
      createMetric("Keluar", formatIDR(expense), "expense"),
      createMetric("Sisa Saldo", formatIDR(balance), balance >= 0 ? "income" : "expense")
    );

    const progressBox = document.createElement("div");
    progressBox.className = "progress-box";

    const progressLabels = document.createElement("div");
    progressLabels.className = "progress-labels";

    const leftLabel = document.createElement("span");
    leftLabel.textContent = `Terpakai: ${usagePercent.toFixed(0)}%`;

    const rightLabel = document.createElement("span");
    rightLabel.textContent = `Tabungan: ${savingRate}%`;

    progressLabels.append(leftLabel, rightLabel);

    const track = document.createElement("div");
    track.className = "progress-track";

    const fill = document.createElement("div");
    fill.className = `progress-fill ${fillClass}`;
    fill.style.width = `${usagePercent}%`;

    track.appendChild(fill);
    progressBox.append(progressLabels, track);

    card.append(topRow, metricsGrid, progressBox);
    profileProgressGrid.appendChild(card);
  });
};

const renderExpenseChart = (expenseList) => {
  const categoryTotals = expenseList.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});

  const labels = Object.keys(categoryTotals);
  const values = Object.values(categoryTotals);

  const ctx = document.getElementById("expenseChart").getContext("2d");

  if (expenseChartInstance) {
    expenseChartInstance.destroy();
  }

  expenseChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Belum ada pengeluaran"],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: values.length
          ? [
              "#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6",
              "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#64748b"
            ]
          : ["#e2e8f0"],
        borderWidth: 2,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 14 }
        }
      }
    }
  });
};

const renderTableRows = (tbodyElement, dataList, emptyMessage, amountClass) => {
  tbodyElement.innerHTML = "";

  if (dataList.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "empty-row";
    td.textContent = emptyMessage;
    tr.appendChild(td);
    tbodyElement.appendChild(tr);
    return;
  }

  dataList.forEach((item) => {
    const tr = document.createElement("tr");
    const itemOwner = normalizeOwner(item.owner);

    const tdDate = document.createElement("td");
    tdDate.textContent = item.date;

    const tdOwner = document.createElement("td");
    const ownerBadge = document.createElement("span");
    ownerBadge.textContent = itemOwner;
    ownerBadge.className = getOwnerBadgeClass(itemOwner);
    tdOwner.appendChild(ownerBadge);

    const tdCategory = document.createElement("td");
    tdCategory.textContent = item.category;

    const tdWallet = document.createElement("td");
    tdWallet.textContent = item.wallet;

    const tdNote = document.createElement("td");
    tdNote.textContent = item.note;

    const tdAmount = document.createElement("td");
    tdAmount.textContent = formatIDR(item.amount);
    tdAmount.className = `text-right ${amountClass}`;

    const tdAction = document.createElement("td");
    tdAction.className = "text-center";
    const delBtn = document.createElement("button");
    delBtn.textContent = "Hapus";
    delBtn.className = "btn-delete";
    delBtn.onclick = () => deleteTransaction(item.id);
    tdAction.appendChild(delBtn);

    tr.append(tdDate, tdOwner, tdCategory, tdWallet, tdNote, tdAmount, tdAction);
    tbodyElement.appendChild(tr);
  });
};

const renderDashboard = () => {
  const selectedMonth = filterMonthInput.value;
  const selectedOwner = filterOwnerInput.value;

  const monthTransactions = transactions.filter(
    (item) => !selectedMonth || item.date.startsWith(selectedMonth)
  );
  renderProfileProgress(monthTransactions);

  const filteredTransactions = monthTransactions
    .filter((item) => {
      const itemOwner = normalizeOwner(item.owner);
      return selectedOwner === "ALL" || itemOwner === selectedOwner;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const incomeList = filteredTransactions.filter((item) => item.type === "income");
  const expenseList = filteredTransactions.filter((item) => item.type === "expense");

  const totalIncome = incomeList.reduce((acc, item) => acc + item.amount, 0);
  const totalExpense = expenseList.reduce((acc, item) => acc + item.amount, 0);
  const netBalance = totalIncome - totalExpense;
  const savingRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : 0;

  document.getElementById("kpiIncome").textContent = formatIDR(totalIncome);
  document.getElementById("kpiExpense").textContent = formatIDR(totalExpense);

  const balanceEl = document.getElementById("kpiBalance");
  balanceEl.textContent = formatIDR(netBalance);
  balanceEl.className = `kpi-value ${netBalance >= 0 ? "income" : "expense"}`;

  document.getElementById("kpiSavingRate").textContent = `${savingRate}%`;

  document.getElementById("incomeCount").textContent = `${incomeList.length} transaksi`;
  document.getElementById("incomeTableTotal").textContent = formatIDR(totalIncome);
  renderTableRows(incomeTableBody, incomeList, "Belum ada catatan uang masuk pada periode ini.", "income");

  document.getElementById("expenseCount").textContent = `${expenseList.length} transaksi`;
  document.getElementById("expenseTableTotal").textContent = formatIDR(totalExpense);
  renderTableRows(expenseTableBody, expenseList, "Belum ada catatan uang keluar pada periode ini.", "expense");

  renderExpenseChart(expenseList);
};

// Simpan Transaksi ke Cloud Firebase
const saveTransactionToCloud = async (txnObj) => {
  if (!db || !currentRoomPin) return;
  const itemRef = ref(db, `rooms/${currentRoomPin}/transactions/${txnObj.id}`);
  await set(itemRef, txnObj);
};

formIncome.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amountValue = Math.round(Number(document.getElementById("inAmount").value));
  if (amountValue <= 0 || Number.isNaN(amountValue)) return;

  const newTxn = {
    id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "income",
    owner: document.getElementById("inOwner").value,
    date: document.getElementById("inDate").value,
    category: document.getElementById("inCategory").value,
    wallet: document.getElementById("inWallet").value,
    amount: amountValue,
    note: document.getElementById("inNote").value.trim()
  };

  await saveTransactionToCloud(newTxn);
  document.getElementById("inAmount").value = "";
  document.getElementById("inNote").value = "";
});

formExpense.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amountValue = Math.round(Number(document.getElementById("exAmount").value));
  if (amountValue <= 0 || Number.isNaN(amountValue)) return;

  const newTxn = {
    id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "expense",
    owner: document.getElementById("exOwner").value,
    date: document.getElementById("exDate").value,
    category: document.getElementById("exCategory").value,
    wallet: document.getElementById("exWallet").value,
    amount: amountValue,
    note: document.getElementById("exNote").value.trim()
  };

  await saveTransactionToCloud(newTxn);
  document.getElementById("exAmount").value = "";
  document.getElementById("exNote").value = "";
});

const deleteTransaction = async (id) => {
  if (!db || !currentRoomPin) return;
  const itemRef = ref(db, `rooms/${currentRoomPin}/transactions/${id}`);
  await remove(itemRef);
};

// Event Form Kode Ruang
roomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  connectToRoom(inputRoomCode.value);
});

btnChangeRoom.addEventListener("click", () => {
  if (unsubscribeListener) unsubscribeListener();
  localStorage.removeItem(ROOM_PIN_STORAGE_KEY);
  currentRoomPin = "";
  dashboardMain.classList.add("hidden");
  roomGateSection.classList.remove("hidden");
  syncStatusBadge.textContent = "Terkunci";
  syncStatusBadge.className = "sync-badge sync-offline";
});

// Migrasi Data Lama dari localStorage ke Firebase
btnMigrateData.addEventListener("click", async () => {
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw || !db || !currentRoomPin) return;

  const parsed = JSON.parse(legacyRaw);
  const updates = {};
  parsed.forEach((item) => {
    updates[`rooms/${currentRoomPin}/transactions/${item.id}`] = {
      ...item,
      owner: normalizeOwner(item.owner)
    };
  });

  await update(ref(db), updates);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  migrationBanner.classList.add("hidden");
  alert("Seluruh data lama berhasil dipindahkan ke Cloud!");
});

btnDismissMigration.addEventListener("click", () => {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  migrationBanner.classList.add("hidden");
});

document.getElementById("btnExportCsv").addEventListener("click", () => {
  if (!transactions.length) {
    alert("Belum ada data transaksi untuk diekspor.");
    return;
  }

  const headers = ["ID", "Tanggal", "Pemilik", "Jenis", "Kategori", "Dompet", "Nominal", "Keterangan"];
  const rows = transactions.map((t) => [
    t.id,
    t.date,
    `"${normalizeOwner(t.owner)}"`,
    t.type === "income" ? "Uang Masuk" : "Uang Keluar",
    `"${t.category}"`,
    `"${t.wallet}"`,
    t.amount,
    `"${t.note.replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan_keuangan_${filterMonthInput.value || "semua"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

filterMonthInput.addEventListener("change", renderDashboard);
filterOwnerInput.addEventListener("change", renderDashboard);

// Inisialisasi Aplikasi
initDefaultDates();
if (currentRoomPin && isFirebaseConfigured) {
  connectToRoom(currentRoomPin);
}