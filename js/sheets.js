/* Google Sheets sync via Google Identity Services (client-side OAuth, no backend). */

const SheetsSync = (() => {
  const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
  const HEADER = ["Date", "Category", "Description", "Odometer (km)", "Litres", "Amount (INR)", "Payment Mode", "Notes"];

  let tokenClient = null;
  let accessToken = null;

  function isConfigured(settings) {
    return Boolean(settings.clientId && settings.sheetId);
  }

  function isConnected() {
    return Boolean(accessToken);
  }

  function initTokenClient(clientId, onToken) {
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      throw new Error("Google Identity Services script not loaded yet. Try again in a moment.");
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          onToken(null, response.error);
          return;
        }
        accessToken = response.access_token;
        onToken(accessToken, null);
      },
    });
  }

  function requestAccess() {
    if (!tokenClient) throw new Error("Token client not initialized. Save your Client ID in Settings first.");
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  }

  function authHeader() {
    if (!accessToken) throw new Error("Not connected to Google. Click 'Connect Google Sheet' first.");
    return { Authorization: `Bearer ${accessToken}` };
  }

  function expenseToRow(e) {
    return [e.date || "", e.category || "", e.description || "", e.odometer ?? "", e.litres ?? "", e.amount ?? "", e.paymentMode || "", e.notes || ""];
  }

  function rowToExpense(row, idx) {
    const [date, category, description, odometer, litres, amount, paymentMode, notes] = row;
    return {
      id: `sheet-${idx}-${Date.now()}`,
      date: date || "",
      category: category || "Other",
      description: description || "",
      odometer: odometer ? Number(odometer) : undefined,
      litres: litres ? Number(litres) : undefined,
      amount: amount ? Number(amount) : 0,
      paymentMode: paymentMode || "",
      notes: notes || "",
    };
  }

  async function pushExpenses(sheetId, expenses) {
    const rows = [HEADER, ...expenses.map(expenseToRow)];
    const range = `Sheet1!A1:H${rows.length}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ range, majorDimension: "ROWS", values: rows }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Sheets API error (${res.status})`);
    }
    return true;
  }

  async function pullExpenses(sheetId) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A2:H10000`;
    const res = await fetch(url, { headers: authHeader() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Sheets API error (${res.status})`);
    }
    const data = await res.json();
    const rows = data.values || [];
    return rows.filter((r) => r.length > 0).map(rowToExpense);
  }

  return { isConfigured, isConnected, initTokenClient, requestAccess, pushExpenses, pullExpenses };
})();
