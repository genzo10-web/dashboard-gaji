const STORAGE_KEY = "SALARY_CASHFLOW_DB_V1";

let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let expenseChartInstance = null;

const form = document.getElementById("transactionForm");
const filterMonthInput = document.getElementById("filterMonth");
const filterOwnerInput = document.getElementById("filterOwner");
const tableBody = document.getElementById("transactionTableBody");
const recordCount = document.getElementById("recordCount");

const formatIDR = (number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(number);
};

const initDefaultDates = () => {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("inputDate").value = today;
  filterMonthInput.value = today.slice(0, 7);
};

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
};

const calculateMetrics = (filteredData) => {
  const totalIncome = filteredData
    .filter((item) => item.type === "income")
    .reduce((acc, item) => acc + item.amount, 0);

  const totalExpense = filteredData
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => acc + item.amount, 0);

  const netBalance = totalIncome - totalExpense;
  const savingRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : 0;

  return { totalIncome, totalExpense, netBalance, savingRate };
};

const renderExpenseChart = (filteredData) => {
  const expenses = filteredData.filter((item) => item.type === "expense");

  const categoryTotals = expenses.reduce((acc, item) => {
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
          ? ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#06b6d4", "#64748b"]
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
          labels: { usePointStyle: true, padding: 16 }
        }
      }
    }
  });
};

const getOwnerBadgeClass = (owner) => {
  if (owner === "Pasangan") return "pill pill-pasangan";
  if (owner === "Dana Bersama") return "pill pill-bersama";
  return "pill pill-gigih";
};

const renderDashboard = () => {
  const selectedMonth = filterMonthInput.value;
  const selectedOwner = filterOwnerInput.value;

  const filteredTransactions = transactions
    .filter((item) => {
      const matchMonth = !selectedMonth || item.date.startsWith(selectedMonth);
      const itemOwner = item.owner || "Mas Gigih";
      const matchOwner = selectedOwner === "ALL" || itemOwner === selectedOwner;
      return matchMonth && matchOwner;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const { totalIncome, totalExpense, netBalance, savingRate } = calculateMetrics(filteredTransactions);
  document.getElementById("kpiIncome").textContent = formatIDR(totalIncome);
  document.getElementById("kpiExpense").textContent = formatIDR(totalExpense);

  const balanceEl = document.getElementById("kpiBalance");
  balanceEl.textContent = formatIDR(netBalance);
  balanceEl.className = `kpi-value ${netBalance >= 0 ? "income" : "expense"}`;

  document.getElementById("kpiSavingRate").textContent = `${savingRate}%`;
  recordCount.textContent = `${filteredTransactions.length} transaksi`;

  tableBody.innerHTML = "";
  filteredTransactions.forEach((item) => {
    const tr = document.createElement("tr");
    const itemOwner = item.owner || "Mas Gigih";

    const tdDate = document.createElement("td");
    tdDate.textContent = item.date;

    const tdOwner = document.createElement("td");
    const ownerBadge = document.createElement("span");
    ownerBadge.textContent = itemOwner;
    ownerBadge.className = getOwnerBadgeClass(itemOwner);
    tdOwner.appendChild(ownerBadge);

    const tdType = document.createElement("td");
    const typeBadge = document.createElement("span");
    typeBadge.textContent = item.type === "income" ? "Masuk" : "Keluar";
    typeBadge.className = item.type === "income" ? "pill pill-in" : "pill pill-out";
    tdType.appendChild(typeBadge);

    const tdCategory = document.createElement("td");
    tdCategory.textContent = item.category;

    const tdWallet = document.createElement("td");
    tdWallet.textContent = item.wallet;

    const tdNote = document.createElement("td");
    tdNote.textContent = item.note;

    const tdAmount = document.createElement("td");
    tdAmount.textContent = formatIDR(item.amount);
    tdAmount.className = "text-right";

    const tdAction = document.createElement("td");
    tdAction.className = "text-center";
    const delBtn = document.createElement("button");
    delBtn.textContent = "Hapus";
    delBtn.className = "btn-delete";
    delBtn.onclick = () => deleteTransaction(item.id);
    tdAction.appendChild(delBtn);

    tr.append(tdDate, tdOwner, tdType, tdCategory, tdWallet, tdNote, tdAmount, tdAction);
    tableBody.appendChild(tr);
  });

  renderExpenseChart(filteredTransactions);
};

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amountValue = Math.round(Number(document.getElementById("inputAmount").value));
  if (amountValue <= 0 || Number.isNaN(amountValue)) return;

  const newTransaction = {
    id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    owner: document.getElementById("inputOwner").value,
    date: document.getElementById("inputDate").value,
    type: document.getElementById("inputType").value,
    category: document.getElementById("inputCategory").value,
    wallet: document.getElementById("inputWallet").value,
    amount: amountValue,
    note: document.getElementById("inputNote").value.trim()
  };

  transactions.push(newTransaction);
  saveState();
  renderDashboard();

  document.getElementById("inputAmount").value = "";
  document.getElementById("inputNote").value = "";
});

const deleteTransaction = (id) => {
  transactions = transactions.filter((item) => item.id !== id);
  saveState();
  renderDashboard();
};

document.getElementById("btnExportCsv").addEventListener("click", () => {
  if (!transactions.length) {
    alert("Belum ada data transaksi untuk diekspor.");
    return;
  }

  const headers = ["ID", "Tanggal", "Pemilik", "Jenis", "Kategori", "Dompet", "Nominal", "Keterangan"];
  const rows = transactions.map((t) => [
    t.id,
    t.date,
    `"${t.owner || "Mas Gigih"}"`,
    t.type === "income" ? "Pemasukan" : "Pengeluaran",
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

initDefaultDates();
renderDashboard();