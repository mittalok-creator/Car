/* App wiring: tabs, forms, table, dashboard, charts, reminders, Google sync. */

(function () {
  const CATEGORIES = ["Fuel", "Service & Maintenance", "Insurance", "Challan/Fine", "Parking/Toll", "EMI/Loan", "Accessories", "Other"];

  let expenses = Store.loadExpenses();
  let settings = Store.loadSettings();
  let reminders = Store.loadReminders();
  let editingId = null;
  let categoryChart, monthlyChart, mileageChart;

  const $ = (id) => document.getElementById(id);
  const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  /* ---------- Tabs ---------- */
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  function switchTab(tab) {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
    if (tab === "dashboard") renderDashboard();
    if (tab === "list") renderTable();
  }

  /* ---------- Settings ---------- */
  function fillSettingsForm() {
    $("sVehicleName").value = settings.vehicleName || "";
    $("sClientId").value = settings.clientId || "";
    $("sSheetId").value = settings.sheetId || "";
    $("vehicleName").textContent = settings.vehicleName || "My Car";
  }

  $("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    settings = {
      ...settings,
      vehicleName: $("sVehicleName").value.trim(),
      clientId: $("sClientId").value.trim(),
      sheetId: $("sSheetId").value.trim(),
    };
    Store.saveSettings(settings);
    $("vehicleName").textContent = settings.vehicleName || "My Car";
    updateSyncButtons();
    alert("Settings saved.");
  });

  function updateSyncButtons() {
    const configured = SheetsSync.isConfigured(settings);
    $("pushBtn").disabled = !(configured && SheetsSync.isConnected());
    $("pullBtn").disabled = !(configured && SheetsSync.isConnected());
    $("connectGoogleBtn").disabled = !settings.clientId;
  }

  /* ---------- Google connect ---------- */
  $("connectGoogleBtn").addEventListener("click", () => {
    if (!settings.clientId) {
      switchTab("settings");
      alert("Pehle Settings mein apna Google OAuth Client ID save karein.");
      return;
    }
    try {
      SheetsSync.initTokenClient(settings.clientId, (token, err) => {
        if (err) {
          $("syncStatus").textContent = "Connection failed";
          console.error(err);
          return;
        }
        $("syncStatus").textContent = "Connected ✓";
        $("syncStatus").classList.add("connected");
        updateSyncButtons();
      });
      SheetsSync.requestAccess();
    } catch (err) {
      alert(err.message);
    }
  });

  $("pushBtn").addEventListener("click", async () => {
    if (!settings.sheetId) return alert("Sheet ID Settings mein daalein.");
    $("pushBtn").disabled = true;
    try {
      await SheetsSync.pushExpenses(settings.sheetId, expenses);
      alert("Data safaltapoorvak Google Sheet mein bhej diya gaya.");
    } catch (err) {
      alert("Push failed: " + err.message);
    } finally {
      updateSyncButtons();
    }
  });

  $("pullBtn").addEventListener("click", async () => {
    if (!settings.sheetId) return alert("Sheet ID Settings mein daalein.");
    if (!confirm("Ye local data ko Google Sheet ke data se overwrite kar dega. Continue?")) return;
    $("pullBtn").disabled = true;
    try {
      const pulled = await SheetsSync.pullExpenses(settings.sheetId);
      expenses = pulled;
      Store.replaceAllExpenses(expenses);
      renderTable();
      renderDashboard();
      alert(`${expenses.length} expenses pull ho gaye.`);
    } catch (err) {
      alert("Pull failed: " + err.message);
    } finally {
      updateSyncButtons();
    }
  });

  /* ---------- Expense form ---------- */
  $("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const expense = {
      date: $("fDate").value,
      category: $("fCategory").value,
      amount: Number($("fAmount").value || 0),
      odometer: $("fOdometer").value ? Number($("fOdometer").value) : undefined,
      litres: $("fLitres").value ? Number($("fLitres").value) : undefined,
      description: $("fDescription").value.trim(),
      paymentMode: $("fPayment").value,
      notes: $("fNotes").value.trim(),
    };
    if (editingId) {
      Store.updateExpense(editingId, expense);
    } else {
      Store.addExpense(expense);
    }
    expenses = Store.loadExpenses();
    resetForm();
    switchTab("list");
  });

  $("cancelEditBtn").addEventListener("click", resetForm);

  function resetForm() {
    editingId = null;
    $("expenseForm").reset();
    $("expenseId").value = "";
    $("formTitle").textContent = "Add Expense";
    $("cancelEditBtn").classList.add("hidden");
    $("fDate").valueAsDate = new Date();
  }

  function editExpense(id) {
    const exp = expenses.find((e) => e.id === id);
    if (!exp) return;
    editingId = id;
    $("fDate").value = exp.date || "";
    $("fCategory").value = exp.category || "Other";
    $("fAmount").value = exp.amount ?? "";
    $("fOdometer").value = exp.odometer ?? "";
    $("fLitres").value = exp.litres ?? "";
    $("fDescription").value = exp.description || "";
    $("fPayment").value = exp.paymentMode || "Cash";
    $("fNotes").value = exp.notes || "";
    $("formTitle").textContent = "Edit Expense";
    $("cancelEditBtn").classList.remove("hidden");
    switchTab("add");
  }

  function deleteExpenseRow(id) {
    if (!confirm("Ye expense delete karna hai?")) return;
    Store.deleteExpense(id);
    expenses = Store.loadExpenses();
    renderTable();
    renderDashboard();
  }

  /* ---------- Table ---------- */
  function populateCategoryFilter() {
    const sel = $("filterCategory");
    sel.innerHTML = '<option value="">All Categories</option>' + CATEGORIES.map((c) => `<option>${c}</option>`).join("");
  }

  $("searchBox").addEventListener("input", renderTable);
  $("filterCategory").addEventListener("change", renderTable);
  $("exportCsvBtn").addEventListener("click", exportCsv);

  function renderTable() {
    const search = $("searchBox").value.toLowerCase();
    const cat = $("filterCategory").value;
    const rows = [...expenses]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .filter((e) => (!cat || e.category === cat))
      .filter((e) => !search || `${e.description} ${e.notes}`.toLowerCase().includes(search));

    $("expenseTableBody").innerHTML = rows
      .map(
        (e) => `
      <tr>
        <td>${e.date || ""}</td>
        <td>${e.category || ""}</td>
        <td>${e.description || ""}</td>
        <td>${e.odometer ?? ""}</td>
        <td class="amount">${fmtMoney(e.amount)}</td>
        <td>${e.paymentMode || ""}</td>
        <td class="row-actions">
          <button onclick="AppActions.edit('${e.id}')">Edit</button>
          <button class="del" onclick="AppActions.del('${e.id}')">Delete</button>
        </td>
      </tr>`
      )
      .join("") || `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">Koi expense nahi mila</td></tr>`;
  }

  function exportCsv() {
    const header = ["Date", "Category", "Description", "Odometer", "Litres", "Amount", "Payment Mode", "Notes"];
    const lines = [header.join(",")];
    expenses.forEach((e) => {
      const row = [e.date, e.category, e.description, e.odometer ?? "", e.litres ?? "", e.amount, e.paymentMode, e.notes]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",");
      lines.push(row);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "car-expenses.csv";
    a.click();
  }

  window.AppActions = { edit: editExpense, del: deleteExpenseRow };

  /* ---------- Reminders ---------- */
  function fillReminderForm() {
    $("rInsurance").value = reminders.insuranceExpiry || "";
    $("rPuc").value = reminders.pucExpiry || "";
    $("rServiceDate").value = reminders.serviceDate || "";
    $("rServiceKm").value = reminders.serviceKm || "";
  }

  $("reminderForm").addEventListener("submit", (e) => {
    e.preventDefault();
    reminders = {
      insuranceExpiry: $("rInsurance").value,
      pucExpiry: $("rPuc").value,
      serviceDate: $("rServiceDate").value,
      serviceKm: $("rServiceKm").value ? Number($("rServiceKm").value) : undefined,
    };
    Store.saveReminders(reminders);
    alert("Reminders saved.");
    renderDashboard();
  });

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
    return Math.ceil(diff);
  }

  function renderReminderBanner() {
    const alerts = [];
    const insuranceDays = daysUntil(reminders.insuranceExpiry);
    const pucDays = daysUntil(reminders.pucExpiry);
    const serviceDays = daysUntil(reminders.serviceDate);

    if (insuranceDays !== null && insuranceDays <= 30) alerts.push(insuranceDays < 0 ? "⚠️ Insurance EXPIRED" : `⚠️ Insurance expires in ${insuranceDays} days`);
    if (pucDays !== null && pucDays <= 30) alerts.push(pucDays < 0 ? "⚠️ PUC EXPIRED" : `⚠️ PUC expires in ${pucDays} days`);
    if (serviceDays !== null && serviceDays <= 15) alerts.push(serviceDays < 0 ? "🔧 Service overdue" : `🔧 Service due in ${serviceDays} days`);

    const lastOdo = getLatestOdometer();
    if (reminders.serviceKm && lastOdo && reminders.serviceKm - lastOdo <= 500) {
      alerts.push(`🔧 Service due in ${Math.max(0, reminders.serviceKm - lastOdo)} km`);
    }

    const banner = $("reminderBanner");
    if (alerts.length) {
      banner.textContent = alerts.join("  •  ");
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  /* ---------- Dashboard ---------- */
  function getLatestOdometer() {
    const withOdo = expenses.filter((e) => e.odometer);
    if (!withOdo.length) return null;
    return Math.max(...withOdo.map((e) => e.odometer));
  }

  function sumInRange(fromDate) {
    return expenses.filter((e) => e.date && new Date(e.date) >= fromDate).reduce((s, e) => s + Number(e.amount || 0), 0);
  }

  function computeMileage() {
    const fuel = expenses
      .filter((e) => e.category === "Fuel" && e.odometer && e.litres)
      .sort((a, b) => a.odometer - b.odometer);
    const points = [];
    for (let i = 1; i < fuel.length; i++) {
      const kmDelta = fuel[i].odometer - fuel[i - 1].odometer;
      const litres = fuel[i].litres;
      if (kmDelta > 0 && litres > 0) {
        points.push({ date: fuel[i].date, kmpl: +(kmDelta / litres).toFixed(2) });
      }
    }
    return points;
  }

  function renderDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    $("statMonth").textContent = fmtMoney(sumInRange(monthStart));
    $("statYear").textContent = fmtMoney(sumInRange(yearStart));
    $("statTotal").textContent = fmtMoney(expenses.reduce((s, e) => s + Number(e.amount || 0), 0));

    const mileagePoints = computeMileage();
    const avgMileage = mileagePoints.length ? (mileagePoints.reduce((s, p) => s + p.kmpl, 0) / mileagePoints.length).toFixed(1) : null;
    $("statMileage").textContent = avgMileage ? `${avgMileage} km/l` : "-- km/l";

    renderReminderBanner();
    renderCharts(mileagePoints);
  }

  function renderCharts(mileagePoints) {
    const categoryTotals = {};
    CATEGORIES.forEach((c) => (categoryTotals[c] = 0));
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount || 0);
    });
    const catLabels = Object.keys(categoryTotals).filter((c) => categoryTotals[c] > 0);
    const catData = catLabels.map((c) => categoryTotals[c]);

    const monthTotals = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      monthTotals[key] = 0;
    }
    expenses.forEach((e) => {
      if (!e.date) return;
      const d = new Date(e.date);
      const key = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      if (key in monthTotals) monthTotals[key] += Number(e.amount || 0);
    });

    const palette = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart($("categoryChart"), {
      type: "doughnut",
      data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: palette }] },
      options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } },
    });

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart($("monthlyChart"), {
      type: "bar",
      data: { labels: Object.keys(monthTotals), datasets: [{ label: "Spend", data: Object.values(monthTotals), backgroundColor: "#2563eb" }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });

    if (mileageChart) mileageChart.destroy();
    mileageChart = new Chart($("mileageChart"), {
      type: "line",
      data: {
        labels: mileagePoints.map((p) => p.date),
        datasets: [{ label: "km/l", data: mileagePoints.map((p) => p.kmpl), borderColor: "#16a34a", tension: 0.3, fill: false }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } },
    });
  }

  /* ---------- Init ---------- */
  function init() {
    fillSettingsForm();
    fillReminderForm();
    populateCategoryFilter();
    resetForm();
    updateSyncButtons();
    renderTable();
    renderDashboard();
  }

  init();
})();
