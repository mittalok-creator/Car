/* App wiring: nav, forms, fuel/service/expense lists, dashboard, reminders, Google sync. */

(function () {
  const CATEGORIES = ["Fuel", "Service & Maintenance", "Insurance", "Challan/Fine", "Parking/Toll", "EMI/Loan", "Accessories", "Other"];
  const OTHER_CATEGORIES = CATEGORIES.filter((c) => c !== "Fuel" && c !== "Service & Maintenance");

  let expenses = Store.loadExpenses();
  let settings = Store.loadSettings();
  let reminders = Store.loadReminders();
  let editingExpenseId = null;
  let categoryChart, monthlyChart;

  const $ = (id) => document.getElementById(id);
  const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const fmtMoney2 = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const todayStr = () => new Date().toISOString().slice(0, 10);

  /* ---------- Navigation ---------- */
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => goPage(btn.dataset.page));
  });
  $("backBtn").addEventListener("click", () => {
    const onSplit = $("page-split").classList.contains("active");
    goPage(onSplit ? "more" : "home");
  });
  $("openSplitBtn").addEventListener("click", () => {
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-split"));
    $("backBtn").classList.remove("hidden");
    renderSplit();
  });

  function goPage(page) {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === `page-${page}`));
    $("backBtn").classList.toggle("hidden", page === "home");
    if (page === "home") renderHome();
    if (page === "fuel") renderFuelList();
    if (page === "service") renderServiceList();
    if (page === "expenses") renderExpenseList();
  }

  /* ---------- Vehicle card ---------- */
  function getLatestOdometer() {
    const withOdo = expenses.filter((e) => e.odometer);
    if (!withOdo.length) return null;
    return Math.max(...withOdo.map((e) => e.odometer));
  }

  function renderVehicleCard() {
    $("vehicleName").textContent = settings.vehicleName || "My Car";
    const odo = getLatestOdometer();
    $("vehicleOdo").textContent = odo ? `${odo.toLocaleString("en-IN")} km on the clock` : "No readings yet";
    if (settings.vehiclePhoto) {
      $("vehiclePhotoImg").src = settings.vehiclePhoto;
      $("vehiclePhotoImg").classList.remove("hidden");
      $("vehiclePhotoPlaceholder").classList.add("hidden");
    } else {
      $("vehiclePhotoImg").classList.add("hidden");
      $("vehiclePhotoPlaceholder").classList.remove("hidden");
    }
  }

  $("editVehicleBtn").addEventListener("click", () => goPage("more"));
  $("vehiclePhotoInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      settings.vehiclePhoto = reader.result;
      Store.saveSettings(settings);
      renderVehicleCard();
    };
    reader.readAsDataURL(file);
  });

  /* ---------- Fuel ---------- */
  $("fuelForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number($("fuelAmount").value || 0);
    const price = Number($("fuelPrice").value || 0);
    const litres = price > 0 ? +(amount / price).toFixed(2) : 0;
    Store.addExpense({
      date: $("fuelDate").value,
      category: "Fuel",
      amount,
      pricePerLitre: price,
      litres,
      odometer: Number($("fuelOdometer").value || 0),
      description: "Fuel fill-up",
      paymentMode: "",
      notes: "",
    });
    expenses = Store.loadExpenses();
    $("fuelForm").reset();
    $("fuelDate").value = todayStr();
    renderFuelList();
    renderVehicleCard();
  });

  function fuelPointsSorted() {
    return expenses
      .filter((e) => e.category === "Fuel" && e.odometer && e.litres)
      .sort((a, b) => a.odometer - b.odometer)
      .map((e, i, arr) => {
        const prev = i > 0 ? arr[i - 1] : null;
        const distance = prev ? e.odometer - prev.odometer : null;
        const kmpl = distance && distance > 0 ? +(distance / e.litres).toFixed(2) : null;
        const costPerKm = distance && distance > 0 ? +(e.amount / distance).toFixed(2) : null;
        return { ...e, distance, kmpl, costPerKm };
      });
  }

  function renderFuelList() {
    const points = fuelPointsSorted();
    const rows = [...points].reverse();
    $("fuelList").innerHTML =
      rows
        .map((e, idx) => {
          const prevKmpl = points[points.length - 1 - idx - 1]?.kmpl;
          let trendClass = "";
          if (e.kmpl != null && prevKmpl != null) trendClass = e.kmpl >= prevKmpl ? "up" : "down";
          const arrow = trendClass === "up" ? " ↑" : trendClass === "down" ? " ↓" : "";
          const metric = e.kmpl != null ? `<span class="kmpl ${trendClass}">${e.kmpl} km/l${arrow}</span>` : `<span class="kmpl">—</span>`;
          const subline = e.costPerKm != null ? `₹${e.costPerKm}/km` : "first fill";
          return `
        <div class="entry-card">
          <div class="entry-main">
            <div class="entry-title">${fmtMoney(e.amount)} · ${e.litres} L</div>
            <div class="entry-sub">${e.date} · ${e.odometer.toLocaleString("en-IN")} km</div>
          </div>
          <div class="entry-metric">
            ${metric}
            <div class="subline">${subline}</div>
          </div>
          <button class="entry-del" onclick="AppActions.delExpense('${e.id}')">✕</button>
        </div>`;
        })
        .join("") || `<div class="entry-empty">No fuel entries yet. Add your first fill-up above.</div>`;
  }

  /* ---------- Service ---------- */
  $("serviceForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const nextDate = $("svcNextDate").value;
    const nextKm = $("svcNextKm").value ? Number($("svcNextKm").value) : undefined;
    Store.addExpense({
      date: $("svcDate").value,
      category: "Service & Maintenance",
      amount: Number($("svcCost").value || 0),
      odometer: Number($("svcOdometer").value || 0),
      description: $("svcWork").value.trim(),
      garage: $("svcGarage").value.trim(),
      nextServiceDate: nextDate || undefined,
      nextServiceKm: nextKm,
      paymentMode: "",
      notes: "",
    });
    expenses = Store.loadExpenses();
    if (nextDate || nextKm) {
      reminders = { ...reminders, serviceDate: nextDate || reminders.serviceDate, serviceKm: nextKm || reminders.serviceKm };
      Store.saveReminders(reminders);
    }
    $("serviceForm").reset();
    $("svcDate").value = todayStr();
    renderServiceList();
    renderVehicleCard();
  });

  function renderServiceList() {
    const rows = expenses.filter((e) => e.category === "Service & Maintenance").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    $("serviceList").innerHTML =
      rows
        .map((e) => {
          const nextBits = [];
          if (e.nextServiceDate) nextBits.push(`next: ${e.nextServiceDate}`);
          if (e.nextServiceKm) nextBits.push(`next: ${e.nextServiceKm.toLocaleString("en-IN")} km`);
          return `
        <div class="entry-card">
          <div class="entry-main">
            <div class="entry-title">${e.description || "Service"}</div>
            <div class="entry-sub">${e.date} · ${(e.odometer || 0).toLocaleString("en-IN")} km${e.garage ? " · " + e.garage : ""}</div>
            ${nextBits.length ? `<div class="entry-sub">${nextBits.join(" · ")}</div>` : ""}
          </div>
          <div class="entry-metric">
            <span class="kmpl">${fmtMoney(e.amount)}</span>
          </div>
          <button class="entry-del" onclick="AppActions.delExpense('${e.id}')">✕</button>
        </div>`;
        })
        .join("") || `<div class="entry-empty">No service records yet.</div>`;
  }

  /* ---------- Other expenses ---------- */
  $("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      date: $("expDate").value,
      category: $("expCategory").value,
      description: $("expDescription").value.trim(),
      amount: Number($("expAmount").value || 0),
      paymentMode: $("expPayment").value,
      notes: "",
    };
    if (editingExpenseId) {
      Store.updateExpense(editingExpenseId, payload);
    } else {
      Store.addExpense(payload);
    }
    expenses = Store.loadExpenses();
    resetExpenseForm();
    renderExpenseList();
  });

  function resetExpenseForm() {
    editingExpenseId = null;
    $("expenseForm").reset();
    $("expDate").value = todayStr();
    $("expenseSubmitBtn").textContent = "Add expense";
  }

  function editExpense(id) {
    const exp = expenses.find((e) => e.id === id);
    if (!exp) return;
    editingExpenseId = id;
    $("expDate").value = exp.date || "";
    $("expCategory").value = exp.category || "Other";
    $("expDescription").value = exp.description || "";
    $("expAmount").value = exp.amount ?? "";
    $("expPayment").value = exp.paymentMode || "Cash";
    $("expenseSubmitBtn").textContent = "Save changes";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function populateCategoryFilter() {
    $("filterCategory").innerHTML = '<option value="">All Categories</option>' + OTHER_CATEGORIES.map((c) => `<option>${c}</option>`).join("");
  }

  $("searchBox").addEventListener("input", renderExpenseList);
  $("filterCategory").addEventListener("change", renderExpenseList);

  function renderExpenseList() {
    const search = $("searchBox").value.toLowerCase();
    const cat = $("filterCategory").value;
    const rows = expenses
      .filter((e) => OTHER_CATEGORIES.includes(e.category))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .filter((e) => !cat || e.category === cat)
      .filter((e) => !search || `${e.description} ${e.category}`.toLowerCase().includes(search));

    $("expenseList").innerHTML =
      rows
        .map(
          (e) => `
        <div class="entry-card" onclick="AppActions.editExpense('${e.id}')">
          <div class="entry-main">
            <div class="entry-title">${e.description || e.category}</div>
            <div class="entry-sub">${e.category} · ${e.date}${e.paymentMode ? " · " + e.paymentMode : ""}</div>
          </div>
          <div class="entry-metric">
            <span class="kmpl">${fmtMoney(e.amount)}</span>
          </div>
          <button class="entry-del" onclick="event.stopPropagation(); AppActions.delExpense('${e.id}')">✕</button>
        </div>`
        )
        .join("") || `<div class="entry-empty">No expenses in this category yet.</div>`;
  }

  function deleteExpenseRow(id) {
    if (!confirm("Ye entry delete karna hai?")) return;
    Store.deleteExpense(id);
    expenses = Store.loadExpenses();
    renderFuelList();
    renderServiceList();
    renderExpenseList();
    renderHome();
    renderVehicleCard();
  }

  window.AppActions = { delExpense: deleteExpenseRow, editExpense };

  /* ---------- Reminders ---------- */
  function fillReminderForm() {
    $("rInsurance").value = reminders.insuranceExpiry || "";
    $("rPuc").value = reminders.pucExpiry || "";
  }

  $("reminderForm").addEventListener("submit", (e) => {
    e.preventDefault();
    reminders = { ...reminders, insuranceExpiry: $("rInsurance").value, pucExpiry: $("rPuc").value };
    Store.saveReminders(reminders);
    alert("Reminders saved.");
    renderHome();
  });

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  }

  function renderReminderChips() {
    const chips = [];
    const insuranceDays = daysUntil(reminders.insuranceExpiry);
    const pucDays = daysUntil(reminders.pucExpiry);
    const serviceDays = daysUntil(reminders.serviceDate);
    const lastOdo = getLatestOdometer();
    const serviceKmLeft = reminders.serviceKm && lastOdo ? reminders.serviceKm - lastOdo : null;

    if (insuranceDays !== null && insuranceDays <= 45) {
      chips.push({ text: insuranceDays < 0 ? "🛡️ Car insurance expired" : `🛡️ Car insurance expires in ${insuranceDays} days`, urgent: insuranceDays <= 7 });
    }
    if (pucDays !== null && pucDays <= 45) {
      chips.push({ text: pucDays < 0 ? "📋 PUC expired" : `📋 PUC expires in ${pucDays} days`, urgent: pucDays <= 7 });
    }
    if (serviceDays !== null && serviceDays <= 30) {
      chips.push({ text: serviceDays < 0 ? "🔧 Service overdue" : `🔧 Service due in ${serviceDays} days`, urgent: serviceDays <= 7 });
    }
    if (serviceKmLeft !== null && serviceKmLeft <= 1000) {
      chips.push({ text: `🔧 Service due in ${Math.max(0, serviceKmLeft).toLocaleString("en-IN")} km`, urgent: serviceKmLeft <= 200 });
    }

    $("reminderChips").innerHTML = chips.map((c) => `<div class="reminder-chip ${c.urgent ? "urgent" : ""}">${c.text}</div>`).join("");
  }

  /* ---------- Home dashboard ---------- */
  function sumInRange(fromDate) {
    return expenses.filter((e) => e.date && new Date(e.date) >= fromDate).reduce((s, e) => s + Number(e.amount || 0), 0);
  }

  function avgMileage() {
    const points = fuelPointsSorted().filter((p) => p.kmpl != null);
    if (!points.length) return null;
    return +(points.reduce((s, p) => s + p.kmpl, 0) / points.length).toFixed(2);
  }

  function renderHome() {
    renderVehicleCard();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    $("statMonth").textContent = fmtMoney(sumInRange(monthStart));
    const avg = avgMileage();
    $("statMileage").textContent = avg ? `${avg} km/l` : "-- km/l";
    renderReminderChips();
    renderCharts();
  }

  function renderCharts() {
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
      monthTotals[d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })] = 0;
    }
    expenses.forEach((e) => {
      if (!e.date) return;
      const key = new Date(e.date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      if (key in monthTotals) monthTotals[key] += Number(e.amount || 0);
    });

    const palette = ["#5b5fef", "#1fa971", "#c8770a", "#e0384a", "#8b5cf6", "#0ea5b8", "#db2777", "#65a30d"];

    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart($("categoryChart"), {
      type: "doughnut",
      data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: palette }] },
      options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } },
    });

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart($("monthlyChart"), {
      type: "bar",
      data: { labels: Object.keys(monthTotals), datasets: [{ label: "Spend", data: Object.values(monthTotals), backgroundColor: "#5b5fef" }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
  }

  /* ---------- Settings & Google sync ---------- */
  function fillSettingsForm() {
    $("sVehicleName").value = settings.vehicleName || "";
    $("sClientId").value = settings.clientId || "";
    $("sSheetId").value = settings.sheetId || "";
  }

  $("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    settings = { ...settings, vehicleName: $("sVehicleName").value.trim(), clientId: $("sClientId").value.trim(), sheetId: $("sSheetId").value.trim() };
    Store.saveSettings(settings);
    renderVehicleCard();
    updateSyncButtons();
    alert("Settings saved.");
  });

  function updateSyncButtons() {
    const configured = SheetsSync.isConfigured(settings);
    $("pushBtn").disabled = !(configured && SheetsSync.isConnected());
    $("pullBtn").disabled = !(configured && SheetsSync.isConnected());
    $("connectGoogleBtn").disabled = !settings.clientId;
  }

  $("connectGoogleBtn").addEventListener("click", () => {
    if (!settings.clientId) return alert("Pehle apna Google OAuth Client ID save karein.");
    try {
      SheetsSync.initTokenClient(settings.clientId, (token, err) => {
        if (err) {
          $("syncStatus").textContent = "Connection failed";
          console.error(err);
          return;
        }
        $("syncStatus").textContent = "Connected ✓";
        $("syncStatus").classList.add("connected");
        $("syncDot").classList.add("connected");
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
      alert("Data Google Sheet mein bhej diya gaya.");
    } catch (err) {
      alert("Push failed: " + err.message);
    } finally {
      updateSyncButtons();
    }
  });

  $("pullBtn").addEventListener("click", async () => {
    if (!settings.sheetId) return alert("Sheet ID Settings mein daalein.");
    if (!confirm("Ye local data ko Sheet ke data se overwrite kar dega. Continue?")) return;
    $("pullBtn").disabled = true;
    try {
      expenses = await SheetsSync.pullExpenses(settings.sheetId);
      Store.replaceAllExpenses(expenses);
      renderHome();
      alert(`${expenses.length} expenses pull ho gaye.`);
    } catch (err) {
      alert("Pull failed: " + err.message);
    } finally {
      updateSyncButtons();
    }
  });

  $("exportCsvBtn").addEventListener("click", () => {
    const header = ["Date", "Category", "Description", "Odometer", "Litres", "Price/Litre", "Amount", "Payment Mode", "Garage", "Next Service Date", "Next Service Km", "Notes"];
    const lines = [header.join(",")];
    expenses.forEach((e) => {
      const row = [e.date, e.category, e.description, e.odometer ?? "", e.litres ?? "", e.pricePerLitre ?? "", e.amount, e.paymentMode, e.garage ?? "", e.nextServiceDate ?? "", e.nextServiceKm ?? "", e.notes ?? ""]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",");
      lines.push(row);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "car-expenses.csv";
    a.click();
  });

  /* ---------- Split Calculator ---------- */
  function readSplitInputs() {
    return {
      month: $("spMonth").value,
      workingDays: Number($("spWorkingDays").value || 0),
      runDays: Number($("spRunDays").value || 0),
      mileage: Number($("spMileage").value || 0),
      petrolPrice: Number($("spPetrolPrice").value || 0),
      kmPerDay: Number($("spKmPerDay").value || 0),
      maintenance: Number($("spMaintenance").value || 0),
      toll: Number($("spToll").value || 0),
      names: $("spNames").value.split("\n").map((s) => s.trim()).filter(Boolean),
      createdBy: $("spCreatedBy").value.trim(),
    };
  }

  function computeSplit(inp) {
    const fuelPerDay = inp.mileage > 0 ? inp.kmPerDay / inp.mileage : 0;
    const fuelCostPerDay = fuelPerDay * inp.petrolPrice;
    const tollPerDay = inp.runDays > 0 ? inp.toll / inp.runDays : 0;
    const fullDailyCost = fuelCostPerDay + inp.maintenance + tollPerDay;
    const totalMonthly = fullDailyCost * inp.runDays;
    const peopleCount = inp.names.length || 1;
    const perHead = totalMonthly / peopleCount;
    return { fuelPerDay, fuelCostPerDay, fullDailyCost, totalMonthly, peopleCount, perHead };
  }

  function fillSplitForm() {
    const sp = settings.split || {};
    $("spMonth").value = sp.month || new Date().toISOString().slice(0, 7);
    $("spWorkingDays").value = sp.workingDays ?? 23;
    $("spRunDays").value = sp.runDays ?? 23;
    $("spMileage").value = sp.mileage ?? 13;
    $("spPetrolPrice").value = sp.petrolPrice ?? 103;
    $("spKmPerDay").value = sp.kmPerDay ?? 80;
    $("spMaintenance").value = sp.maintenance ?? 50;
    $("spToll").value = sp.toll ?? 360;
    $("spNames").value = (sp.names || []).join("\n");
    $("spCreatedBy").value = sp.createdBy || "";
  }

  function renderSplit() {
    const inp = readSplitInputs();
    const c = computeSplit(inp);
    $("spFuelPerDay").textContent = `${c.fuelPerDay.toFixed(2)} L`;
    $("spFuelCostPerDay").textContent = fmtMoney2(c.fuelCostPerDay);
    $("spFullDailyCost").textContent = fmtMoney2(c.fullDailyCost);
    $("spTotalMonthly").textContent = fmtMoney2(c.totalMonthly);
    $("spPeopleCount").textContent = c.peopleCount;
    $("spPerHead").textContent = fmtMoney2(Math.round(c.perHead));
  }

  $("splitForm").addEventListener("input", renderSplit);
  $("splitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    settings = { ...settings, split: readSplitInputs() };
    Store.saveSettings(settings);
    alert("Saved.");
  });

  function monthLabel(monthValue) {
    if (!monthValue) return "";
    const [y, m] = monthValue.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }

  function drawSplitCard(inp, c) {
    const canvas = $("splitCanvas");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const dark = "#2f5233";
    const sage = "#7fa887";
    const altRow = "#eaf3e7";
    const yellow = "#fdf3c4";
    const blue = "#1a3fd6";
    const marginX = 40;
    const contentW = W - marginX * 2;
    let y = 0;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = dark;
    ctx.fillRect(0, y, W, 110);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px -apple-system, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Monthly Car Expense", W / 2, y + 55);
    y += 150;

    ctx.fillStyle = sage;
    ctx.fillRect(marginX, y, contentW, 50);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px -apple-system, Arial";
    ctx.textAlign = "left";
    ctx.fillText("INPUTS", marginX + 20, y + 25);
    y += 50;

    const inputRows = [
      ["Month", monthLabel(inp.month)],
      ["No. of Working Days", String(inp.workingDays)],
      ["No. of Days Car Runs", String(inp.runDays)],
      ["Car Mileage (km / litre)", inp.mileage.toFixed(2)],
      ["Petrol Price (₹ / litre)", inp.petrolPrice.toFixed(2)],
      ["Running KMs per Day", inp.kmPerDay.toFixed(2)],
      ["Maintenance per Day (₹)", `₹${inp.maintenance.toFixed(2)}`],
      ["Toll per Month (₹)", `₹${inp.toll.toFixed(2)}`],
    ];
    const rowH = 52;
    const valColW = 300;
    inputRows.forEach(([label, value], i) => {
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : altRow;
      ctx.fillRect(marginX, y, contentW - valColW, rowH);
      ctx.fillStyle = yellow;
      ctx.fillRect(marginX + contentW - valColW, y, valColW, rowH);
      ctx.strokeStyle = "#d7ddd2";
      ctx.strokeRect(marginX, y, contentW, rowH);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "24px -apple-system, Arial";
      ctx.textAlign = "left";
      ctx.fillText(label, marginX + 16, y + rowH / 2 + 1);
      ctx.fillStyle = blue;
      ctx.font = "bold 24px -apple-system, Arial";
      ctx.textAlign = "right";
      ctx.fillText(value, marginX + contentW - 16, y + rowH / 2 + 1);
      y += rowH;
    });

    y += 30;
    ctx.fillStyle = sage;
    ctx.fillRect(marginX, y, contentW, 50);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px -apple-system, Arial";
    ctx.textAlign = "left";
    ctx.fillText("PER-DAY BREAKDOWN", marginX + 20, y + 25);
    y += 50;

    const breakdownRows = [
      ["Fuel needed per Day (litre)", c.fuelPerDay.toFixed(2), false],
      ["Fuel Cost per Day (₹)", fmtMoney2(c.fuelCostPerDay), false],
      ["Full Daily Cost (incl. toll)", fmtMoney2(c.fullDailyCost), true],
    ];
    breakdownRows.forEach(([label, value, bold], i) => {
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : altRow;
      ctx.fillRect(marginX, y, contentW, rowH);
      ctx.strokeStyle = "#d7ddd2";
      ctx.strokeRect(marginX, y, contentW, rowH);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = `${bold ? "bold " : ""}24px -apple-system, Arial`;
      ctx.textAlign = "left";
      ctx.fillText(label, marginX + 16, y + rowH / 2 + 1);
      ctx.textAlign = "right";
      ctx.fillText(value, marginX + contentW - 16, y + rowH / 2 + 1);
      y += rowH;
    });

    y += 30;
    ctx.fillStyle = sage;
    ctx.fillRect(marginX, y, contentW, 50);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px -apple-system, Arial";
    ctx.textAlign = "left";
    ctx.fillText("MONTHLY TOTALS", marginX + 20, y + 25);
    y += 50;

    const totalRows = [
      ["Total Monthly Expense (₹)", fmtMoney2(c.totalMonthly), true],
      ["No. of People (from names)", String(c.peopleCount), false],
    ];
    totalRows.forEach(([label, value, bold], i) => {
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : altRow;
      ctx.fillRect(marginX, y, contentW, rowH);
      ctx.strokeStyle = "#d7ddd2";
      ctx.strokeRect(marginX, y, contentW, rowH);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = `${bold ? "bold " : ""}24px -apple-system, Arial`;
      ctx.textAlign = "left";
      ctx.fillText(label, marginX + 16, y + rowH / 2 + 1);
      ctx.textAlign = "right";
      ctx.fillText(value, marginX + contentW - 16, y + rowH / 2 + 1);
      y += rowH;
    });

    y += 30;
    ctx.fillStyle = dark;
    ctx.fillRect(marginX, y, contentW, 60);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px -apple-system, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Per Head Expense for the Month", W / 2, y + 30);
    y += 60;
    ctx.fillStyle = dark;
    ctx.fillRect(marginX, y, contentW, 100);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px -apple-system, Arial";
    ctx.fillText(fmtMoney2(Math.round(c.perHead)), W / 2, y + 50);
    y += 140;

    if (inp.createdBy) {
      ctx.fillStyle = "#555555";
      ctx.font = "22px -apple-system, Arial";
      ctx.textAlign = "right";
      ctx.fillText(`Created by ${inp.createdBy}`, marginX + contentW, y);
      y += 30;
    }
  }

  async function shareOrDownloadSplit(mode) {
    const inp = readSplitInputs();
    const c = computeSplit(inp);
    drawSplitCard(inp, c);
    const canvas = $("splitCanvas");
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const fileName = `car-expense-split-${inp.month || "monthly"}.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    if (mode === "share" && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Monthly Car Expense" });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  $("shareSplitBtn").addEventListener("click", () => shareOrDownloadSplit("share"));
  $("downloadSplitBtn").addEventListener("click", () => shareOrDownloadSplit("download"));

  /* ---------- Init ---------- */
  function init() {
    $("fuelDate").value = todayStr();
    $("svcDate").value = todayStr();
    $("expDate").value = todayStr();
    fillSettingsForm();
    fillReminderForm();
    fillSplitForm();
    populateCategoryFilter();
    updateSyncButtons();
    renderHome();
    renderSplit();
  }

  init();
})();
