const REFRESH_INTERVAL = 5000;
let refreshIntervalId = null;

async function fetchLatestData() {
  try {
    const response = await fetch('/data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const temp = parseFloat(data.temperature);
    const hum = parseFloat(data.humidity);

    if (!isNaN(temp) && !isNaN(hum)) {
      document.getElementById('error').style.display = 'none';
      document.getElementById('tempValue').textContent = `${temp.toFixed(1)}°C`;
      document.getElementById('humValue').textContent = `${hum.toFixed(1)}%`;

      const now = new Date();
      document.getElementById('status').textContent = `Last updated: ${now.toLocaleTimeString()}`;

      document.getElementById('dataIndicator').className = 'indicator on';
      document.getElementById('dataStatus').textContent = 'Incoming Data: On';
    } else {
      showError('Invalid data format.');
    }
  } catch (error) {
    console.error(error);
    showError(`Error loading data: ${error.message}`);
  }
}

function showError(message) {
  const errorEl = document.getElementById('error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';

  document.getElementById('dataIndicator').className = 'indicator off';
  document.getElementById('dataStatus').textContent = 'Incoming Data: Off';
}

// Start polling
fetchLatestData();
refreshIntervalId = setInterval(fetchLatestData, REFRESH_INTERVAL);

// Clean up
window.addEventListener('beforeunload', () => {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
});
