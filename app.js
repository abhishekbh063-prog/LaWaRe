// Configuration - UPDATE THIS WITH YOUR DEPLOYED APPS SCRIPT URL
const API_URL = 'https://script.google.com/macros/s/AKfycbwHCtMZXH1_QVn8iHz-coI_fDBm-QLhREnP_RXrj8wAendlcHL-7drWt6QkJMZuwGFM1g/exec';

// Global state
let appData = {
    laborers: [],
    workTypes: [],
    workLogs: []
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Materialize components
    M.Sidenav.init(document.querySelectorAll('.sidenav'));
    M.FormSelect.init(document.querySelectorAll('select'));
    M.Datepicker.init(document.querySelectorAll('input[type="date"]'), {
        format: 'yyyy-mm-dd',
        defaultDate: new Date(),
        setDefaultDate: true
    });
    
    // Set today's date
    document.getElementById('work-date').valueAsDate = new Date();
    
    // Load initial data
    loadAppData();
    
    // Setup form handlers
    setupFormHandlers();
    
    // Setup auto-calculation
    setupAutoCalculation();
});

// API call helper
async function apiCall(action, data = null, method = 'GET') {
    showLoading();
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        let url = API_URL;
        
        if (method === 'GET') {
            url += `?action=${action}`;
            if (data) {
                url += `&filters=${encodeURIComponent(JSON.stringify(data))}`;
            }
        } else {
            options.body = JSON.stringify({ action, ...data });
        }
        
        const response = await fetch(url, options);
        const result = await response.json();
        
        hideLoading();
        return result;
    } catch (error) {
        hideLoading();
        console.error('API Error:', error);
        M.toast({ html: 'Error: ' + error.message, classes: 'red' });
        return { success: false, error: error.message };
    }
}

// Load all app data
async function loadAppData() {
    await Promise.all([
        loadLaborers(),
        loadWorkTypes(),
        loadDashboard()
    ]);
}

// Load laborers
async function loadLaborers() {
    const result = await apiCall('getLaborers');
    if (Array.isArray(result)) {
        appData.laborers = result;
        updateLaborerDropdown();
        updateLaborersList();
    }
}

// Load work types
async function loadWorkTypes() {
    const result = await apiCall('getWorkTypes');
    if (Array.isArray(result)) {
        appData.workTypes = result;
        updateWorkTypeDropdown();
    }
}

// Load dashboard data
async function loadDashboard() {
    const result = await apiCall('getDashboard');
    if (result.success) {
        updateDashboardStats(result.stats);
        updateRecentWorkLogs(result.recentWorkLogs);
    }
}

// Update dashboard statistics
function updateDashboardStats(stats) {
    document.getElementById('stat-laborers').textContent = stats.totalLaborers || 0;
    document.getElementById('stat-worklogs').textContent = stats.totalWorkLogs || 0;
    document.getElementById('stat-wages').textContent = '₹' + (stats.totalWagesEarned || 0).toFixed(2);
    document.getElementById('stat-loans').textContent = '₹' + (stats.totalLoanBalance || 0).toFixed(2);
}

// Update recent work logs
function updateRecentWorkLogs(workLogs) {
    const tbody = document.getElementById('recent-worklogs');
    if (!workLogs || workLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="center">No recent work logs</td></tr>';
        return;
    }
    
    tbody.innerHTML = workLogs.slice(0, 5).map(log => {
        const laborer = appData.laborers.find(l => l.ID === log.LaborerID);
        return `
            <tr>
                <td>${formatDate(log.Date)}</td>
                <td>${laborer ? laborer.Name : log.LaborerID}</td>
                <td>${log.WorkType}</td>
                <td>₹${log.WageEarned.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
}

// Update laborer dropdown
function updateLaborerDropdown() {
    const select = document.getElementById('laborer-select');
    select.innerHTML = '<option value="">Select Laborer</option>' +
        appData.laborers.map(l => 
            `<option value="${l.ID}">${l.Name} (${l.Phone})</option>`
        ).join('');
    M.FormSelect.init(select);
}

// Update work type dropdown
function updateWorkTypeDropdown() {
    const select = document.getElementById('worktype-select');
    select.innerHTML = '<option value="">Select Work Type</option>' +
        appData.workTypes.map(wt => 
            `<option value="${wt.Category}">${wt.Category} (₹${wt.DefaultRate}/hr)</option>`
        ).join('');
    M.FormSelect.init(select);
}

// Update laborers list
function updateLaborersList() {
    const tbody = document.getElementById('laborers-list');
    if (appData.laborers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="center">No laborers found</td></tr>';
        return;
    }
    
    tbody.innerHTML = appData.laborers.map(l => `
        <tr>
            <td>${l.Name}</td>
            <td>${l.Phone}</td>
            <td>₹${(l.LoanBalance || 0).toFixed(2)}</td>
        </tr>
    `).join('');
}

// Setup form handlers
function setupFormHandlers() {
    // Work log form
    document.getElementById('worklog-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            Date: document.getElementById('work-date').value,
            LaborerID: document.getElementById('laborer-select').value,
            WorkType: document.getElementById('worktype-select').value,
            WageEarned: parseFloat(document.getElementById('wage-earned').value),
            CashPaid: parseFloat(document.getElementById('cash-paid').value)
        };
        
        const result = await apiCall('addWorkLog', data, 'POST');
        
        if (result.success) {
            M.toast({ html: 'Work log added successfully!', classes: 'green' });
            e.target.reset();
            document.getElementById('work-date').valueAsDate = new Date();
            loadDashboard();
        } else {
            M.toast({ html: 'Error: ' + result.message, classes: 'red' });
        }
    });
    
    // Laborer form
    document.getElementById('laborer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            Name: document.getElementById('laborer-name').value,
            Phone: document.getElementById('laborer-phone').value
        };
        
        const result = await apiCall('addLaborer', data, 'POST');
        
        if (result.success) {
            M.toast({ html: 'Laborer added successfully!', classes: 'green' });
            e.target.reset();
            loadLaborers();
        } else {
            M.toast({ html: 'Error: ' + result.message, classes: 'red' });
        }
    });
}

// Setup auto-calculation for loan deduction
function setupAutoCalculation() {
    const wageInput = document.getElementById('wage-earned');
    const cashInput = document.getElementById('cash-paid');
    const deductionInput = document.getElementById('loan-deduction');
    
    function calculate() {
        const wage = parseFloat(wageInput.value) || 0;
        const cash = parseFloat(cashInput.value) || 0;
        deductionInput.value = (wage - cash).toFixed(2);
    }
    
    wageInput.addEventListener('input', calculate);
    cashInput.addEventListener('input', calculate);
}

// Load reports
async function loadReports() {
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    
    if (!startDate || !endDate) {
        M.toast({ html: 'Please select both start and end dates', classes: 'orange' });
        return;
    }
    
    const filters = { startDate, endDate };
    const result = await apiCall('getWorkLogs', filters);
    
    const tbody = document.getElementById('reports-list');
    if (!result || result.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="center">No work logs found</td></tr>';
        return;
    }
    
    tbody.innerHTML = result.map(log => {
        const laborer = appData.laborers.find(l => l.ID === log.LaborerID);
        return `
            <tr>
                <td>${formatDate(log.Date)}</td>
                <td>${laborer ? laborer.Name : log.LaborerID}</td>
                <td>${log.WorkType}</td>
                <td>₹${log.WageEarned.toFixed(2)}</td>
                <td>₹${log.CashPaid.toFixed(2)}</td>
                <td>₹${log.LoanDeduction.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
}

// Page navigation
function showPage(pageName) {
    document.querySelectorAll('.page-section').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageName + '-page').classList.add('active');
}

// Close sidenav
function closeSidenav() {
    const sidenav = M.Sidenav.getInstance(document.getElementById('mobile-nav'));
    if (sidenav) sidenav.close();
}

// Loading indicator
function showLoading() {
    document.getElementById('loading').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('active');
}

// Utility functions
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN');
}
