const char* htmlPage = R"=====(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <title>ESP32 DHT11 Monitor</title>
  <style>
    html { font-family: Arial; display: inline-block; margin: 0px auto; text-align: center; }
    h2 { font-size: 3.0rem; }
    .status-card { background: #f8f9fa; border-radius: 10px; padding: 15px; margin: 10px auto; max-width: 500px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .status-value { font-size: 2.5rem; font-weight: bold; }
    .temp-status { color: #ca3517; }
    .humidity-status { color: #00add6; }
    .chart-container { width: 100%; max-width: 800px; margin: 20px auto; }
    table { width: 100%; max-width: 800px; margin: 20px auto; border-collapse: collapse; }
    th, td { padding: 8px; border: 1px solid #ddd; text-align: center; }
    th { background-color: #f8f9fa; }
    .units { font-size: 1.2rem; }
  </style>
</head>
<body>
  <h2>DHT11 Sensor Monitor</h2>
  
  <div class="status-card">
    <i class="fas fa-thermometer-half fa-2x temp-status"></i>
    <span>Temperature: </span>
    <span id="temperature-value" class="status-value temp-status">--</span>
    <sup class="units">°C</sup>
  </div>
  
  <div class="status-card">
    <i class="fas fa-tint fa-2x humidity-status"></i>
    <span>Humidity: </span>
    <span id="humidity-value" class="status-value humidity-status">--</span>
    <sup class="units">%</sup>
  </div>

  <div class="chart-container">
    <canvas id="sensorChart"></canvas>
  </div>

  <h3>Recent Readings</h3>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Temperature</th>
        <th>Humidity</th>
      </tr>
    </thead>
    <tbody id="readings-table">
      <tr><td colspan="3">Loading data...</td></tr>
    </tbody>
  </table>

  <script>
    const ctx = document.getElementById('sensorChart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Temperature (°C)',
          borderColor: '#ca3517',
          backgroundColor: 'rgba(202, 53, 23, 0.1)',
          tension: 0.3,
          yAxisID: 'y'
        }, {
          label: 'Humidity (%)',
          borderColor: '#00add6',
          backgroundColor: 'rgba(0, 173, 214, 0.1)',
          tension: 0.3,
          yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Temperature (°C)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Humidity (%)' },
            grid: { drawOnChartArea: false },
            min: 0,
            max: 100
          }
        }
      }
    });

    const readingsHistory = [];
    
    function updateUI(data) {
      document.getElementById('temperature-value').textContent = data.temperature.toFixed(2);
      document.getElementById('humidity-value').textContent = data.humidity.toFixed(2);
      
      const now = new Date();
      chart.data.labels.push(now.toLocaleTimeString());
      chart.data.datasets[0].data.push(data.temperature);
      chart.data.datasets[1].data.push(data.humidity);
      
      if (chart.data.labels.length > 15) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
        chart.data.datasets[1].data.shift();
      }
      chart.update();
      
      readingsHistory.unshift({
        time: now.toLocaleTimeString(),
        temperature: data.temperature.toFixed(2),
        humidity: data.humidity.toFixed(2)
      });
      
      if (readingsHistory.length > 10) readingsHistory.pop();
      
      document.getElementById('readings-table').innerHTML = readingsHistory.map(reading => `
        <tr>
          <td>${reading.time}</td>
          <td>${reading.temperature} °C</td>
          <td>${reading.humidity} %</td>
        </tr>
      `).join('');
    }
    
    function fetchSensorData() {
      fetch('/data.json')
        .then(response => response.json())
        .then(data => updateUI(data))
        .catch(error => console.error('Error:', error));
    }
    
    fetchSensorData();
    setInterval(fetchSensorData, 5000);
  </script>
</body>
</html>
)=====";