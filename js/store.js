/* Local persistence layer: expenses, reminders, settings. */

const Store = (() => {
  const EXPENSES_KEY = "car_expenses_v1";
  const REMINDERS_KEY = "car_reminders_v1";
  const SETTINGS_KEY = "car_settings_v1";

  function loadExpenses() {
    try {
      return JSON.parse(localStorage.getItem(EXPENSES_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveExpenses(expenses) {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  }

  function addExpense(expense) {
    const expenses = loadExpenses();
    expense.id = expense.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    expenses.push(expense);
    saveExpenses(expenses);
    return expense;
  }

  function updateExpense(id, patch) {
    const expenses = loadExpenses();
    const idx = expenses.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    expenses[idx] = { ...expenses[idx], ...patch };
    saveExpenses(expenses);
    return expenses[idx];
  }

  function deleteExpense(id) {
    const expenses = loadExpenses().filter((e) => e.id !== id);
    saveExpenses(expenses);
  }

  function replaceAllExpenses(expenses) {
    saveExpenses(expenses);
  }

  function loadReminders() {
    try {
      return JSON.parse(localStorage.getItem(REMINDERS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveReminders(reminders) {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  }

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  return {
    loadExpenses,
    saveExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    replaceAllExpenses,
    loadReminders,
    saveReminders,
    loadSettings,
    saveSettings,
  };
})();
