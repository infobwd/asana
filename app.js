/* KruBoard front-end (GitHub hosted) */
const APP_CONFIG = {
  scriptUrl: 'https://script.google.com/macros/s/AKfycbwSGyuR6e3OB2T2e4HJ59KqHwvvwp6BFoNjN-SLj0es4M9iWhrsm2AJbFeNjc8PEhZYuA/exec',
  liffId: '2006490627-3NpRPl0G'
};

const state = {
  isLoggedIn: false,
  profile: null,
  upcomingDays: 7,
  tasks: [],
  userStats: [],
  dashboard: null,
  apiKey: localStorage.getItem('kruboard_api_key') || ''
};

const els = {
  navItems: [],
  pages: {},
  homePage: null,
  tasksPage: null,
  teachersPage: null,
  profilePage: null,
  headerTotals: {
    totalTasks: document.getElementById('headerTotalTasks'),
    upcomingTasks: document.getElementById('headerUpcomingTasks'),
    totalUsers: document.getElementById('headerTotalUsers'),
    completionRate: document.getElementById('headerCompletionRate')
  },
  stats: {
    completed: document.getElementById('completedCount'),
    pending: document.getElementById('pendingCount'),
    month: document.getElementById('monthTaskCount'),
    completionRate: document.getElementById('completionRate')
  },
  notificationCount: document.getElementById('notificationCount'),
  taskCardsContainer: document.getElementById('taskCardsContainer'),
  allTasksContainer: document.getElementById('allTasksContainer'),
  userStatsContainer: document.getElementById('userStatsContainer'),
  loadingToast: document.getElementById('loadingToast'),
  refreshBtn: document.getElementById('refreshBtn'),
  fabBtn: document.getElementById('fabBtn'),
  timeFilters: Array.from(document.querySelectorAll('.time-filter')),
  nav: Array.from(document.querySelectorAll('.nav-item')),
  notificationBtn: document.getElementById('notificationBtn')
};

document.addEventListener('DOMContentLoaded', init);

function init(){
  cachePages();
  bindUI();
  showLoading(true);
  initializeLiff()
    .catch(err=>{
      console.error('LIFF init failed:', err);
      renderLoginBanner();
      renderProfilePage();
    })
    .finally(()=>{
      loadPublicData()
        .then(()=> state.isLoggedIn ? loadSecureData() : null)
        .catch(err=>{
          handleDataError(err, 'โหลดข้อมูลล้มเหลว กรุณาลองใหม่');
        })
        .finally(()=> showLoading(false));
    });
}

function cachePages(){
  const pages = Array.from(document.querySelectorAll('.page'));
  pages.forEach(page => {
    els.pages[page.id] = page;
  });
  els.homePage = els.pages.homePage;
  els.tasksPage = els.pages.tasksPage;
  els.teachersPage = els.pages.teachersPage;
  els.profilePage = els.pages.profilePage;
  els.navItems = els.nav;
  if (!els.homePage){
    console.warn('homePage not found – layout may be outdated');
  }
}

function bindUI(){
  els.navItems.forEach(item=>{
    item.addEventListener('click', evt=>{
      evt.preventDefault();
      const pageId = item.getAttribute('data-page');
      if (!state.isLoggedIn && pageId !== 'homePage'){
        toastInfo('กรุณาเข้าสู่ระบบผ่าน LINE เพื่อดูรายละเอียด');
        return;
      }
      switchPage(pageId);
    });
  });

  if (els.refreshBtn){
    els.refreshBtn.addEventListener('click', ()=>{
      showLoading(true);
      const target = state.isLoggedIn ? loadSecureData() : Promise.resolve();
      Promise.all([loadPublicData(), target])
        .catch(err=>{
          console.error('Refresh error:', err);
          toastError('รีเฟรชข้อมูลไม่สำเร็จ');
        })
        .finally(()=> showLoading(false));
    });
  }

  els.timeFilters.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const days = Number(btn.dataset.days || '7');
      state.upcomingDays = days;
      els.timeFilters.forEach(b=>b.classList.remove('active','bg-blue-600','text-white'));
      btn.classList.add('active','bg-blue-600','text-white');
      loadUpcomingTasks();
    });
  });

  if (els.fabBtn){
    els.fabBtn.addEventListener('click', ()=> window.scrollTo({ top:0, behavior:'smooth' }));
    window.addEventListener('scroll', ()=>{
      const shouldShow = window.scrollY > 300;
      els.fabBtn.classList.toggle('hidden', !shouldShow);
    });
  }

  if (els.notificationBtn){
    els.notificationBtn.addEventListener('click', ()=>{
      toastInfo('ยังไม่มีการแจ้งเตือนใหม่');
    });
  }

  if (els.allTasksContainer){
    els.allTasksContainer.addEventListener('click', evt=>{
      const button = evt.target.closest('[data-action="update-status"]');
      if (!button) return;
      const taskId = button.dataset.taskId;
      handleUpdateStatus(taskId);
    });
  }
}

function ensureLiffSdk(){
  if (typeof liff !== 'undefined') return Promise.resolve();
  if (document.getElementById('liff-sdk')){
    return waitForLiffInstance(3000);
  }
  return new Promise((resolve, reject)=>{
    const script = document.createElement('script');
    script.id = 'liff-sdk';
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    script.async = true;
    script.onload = ()=> waitForLiffInstance(0).then(resolve).catch(reject);
    script.onerror = ()=> reject(new Error('โหลด LIFF SDK ไม่สำเร็จ'));
    document.head.appendChild(script);
  });
}

function waitForLiffInstance(timeoutMs){
  const deadline = Date.now() + (timeoutMs || 0);
  return new Promise((resolve, reject)=>{
    (function poll(){
      if (typeof liff !== 'undefined'){
        resolve();
        return;
      }
      if (Date.now() > deadline){
        reject(new Error('LIFF SDK not available'));
        return;
      }
      setTimeout(poll, 100);
    })();
  });
}

async function initializeLiff(){
  try{
    await ensureLiffSdk();
  }catch(err){
    console.warn('LIFF SDK not loaded. Login disabled.', err);
    throw err;
  }
  try{
    await liff.init({ liffId: APP_CONFIG.liffId });
    state.isLoggedIn = liff.isLoggedIn();
    if (state.isLoggedIn){
      const profile = await liff.getProfile();
      const idToken = liff.getIDToken ? liff.getIDToken() : '';
      const decoded = liff.getDecodedIDToken ? liff.getDecodedIDToken() : null;
      state.profile = {
        name: profile?.displayName || '',
        pictureUrl: profile?.pictureUrl || '',
        userId: profile?.userId || '',
        statusMessage: profile?.statusMessage || '',
        email: decoded?.email || '',
        idToken
      };
    } else {
      renderLoginBanner();
    }
    renderProfilePage();
  }catch(err){
    console.error('LIFF init error:', err);
    throw err;
  }
}

function renderLoginBanner(){
  if (!els.homePage) return;
  let banner = document.getElementById('loginBanner');
  if (!banner){
    banner = document.createElement('div');
    banner.id = 'loginBanner';
    banner.className = 'bg-white border border-blue-200 rounded-xl p-4 mb-4 shadow-sm';
    els.homePage.insertBefore(banner, els.homePage.firstChild);
  }
  banner.innerHTML = `
    <div class="flex items-center justify-between space-x-3">
      <div>
        <h2 class="text-base font-semibold text-gray-800">เข้าสู่ระบบผ่าน LINE</h2>
        <p class="text-sm text-gray-500">ล็อกอินเพื่อดูรายละเอียดงานและอัปเดตสถานะ</p>
      </div>
      <button class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2" id="loginWithLineBtn">
        <span class="material-icons text-base">chat</span>
        <span>เข้าสู่ระบบ</span>
      </button>
    </div>
  `;
  const loginBtn = document.getElementById('loginWithLineBtn');
  if (loginBtn){
    loginBtn.addEventListener('click', ()=>{
      if (typeof liff === 'undefined'){
        toastError('ไม่พบ LIFF SDK');
        return;
      }
      liff.login({ redirectUri: window.location.href });
    });
  }
}

function switchPage(pageId){
  Object.values(els.pages).forEach(page=>{
    page.classList.toggle('active', page.id === pageId);
  });
  els.navItems.forEach(item=>{
    const match = item.getAttribute('data-page') === pageId;
    item.classList.toggle('active', match);
  });
}

function showLoading(show){
  if (!els.loadingToast) return;
  els.loadingToast.classList.toggle('hidden', !show);
}

function toastError(message){
  console.warn(message);
  alert(message);
}

function toastInfo(message){
  console.info(message);
  alert(message);
}

function handleDataError(err, fallbackMessage){
  console.error('Data error:', err);
  if (err?.code === 'JSONP_NETWORK'){
    toastError('ไม่สามารถเชื่อมต่อ Apps Script ได้ โปรดตรวจสอบว่าเว็บแอปเผยแพร่แบบ Anyone และ URL ถูกต้อง');
  } else {
    toastError(fallbackMessage);
  }
}

async function loadPublicData(){
  const [dashboard] = await Promise.all([fetchDashboardStats(), loadUpcomingTasks()]);
  state.dashboard = dashboard;
  renderDashboard(dashboard);
}

function fetchDashboardStats(){
  return jsonpRequest({ action:'dashboard' })
    .then(res=>{
      if (!res || res.success === false){
        throw new Error(res?.message || 'dashboard error');
      }
      return res.data || {};
    });
}

function loadUpcomingTasks(){
  return jsonpRequest({ action:'upcoming', days: state.upcomingDays })
    .then(res=>{
      if (!res || res.success === false){
        throw new Error(res?.message || 'upcoming error');
      }
      const data = Array.isArray(res.data) ? res.data : [];
      renderUpcomingTasks(data);
      return data;
    })
    .catch(err=>{
      console.error('Upcoming error:', err);
      renderUpcomingTasks([]);
      return [];
    });
}

function loadSecureData(){
  return Promise.all([
    fetchAllTasks(),
    fetchUserStats()
  ]).then(([tasks, stats])=>{
    state.tasks = tasks;
    state.userStats = stats;
    renderTasks(tasks);
    renderUserStats(stats);
  }).catch(err=>{
    handleDataError(err, 'ไม่สามารถโหลดข้อมูลแบบละเอียดได้');
  });
}

function fetchAllTasks(){
  return jsonpRequest({ action:'tasks' })
    .then(res=>{
      if (!res || res.success === false){
        throw new Error(res?.message || 'tasks error');
      }
      return Array.isArray(res.data) ? res.data : [];
    });
}

function fetchUserStats(){
  return jsonpRequest({ action:'user_stats' })
    .then(res=>{
      if (!res || res.success === false){
        throw new Error(res?.message || 'user stats error');
      }
      return Array.isArray(res.data) ? res.data : [];
    });
}

function renderDashboard(data){
  const summary = data?.summary || {};
  setText(els.headerTotals.totalTasks, summary.totalTasks || 0);
  setText(els.headerTotals.upcomingTasks, summary.upcomingTasks || 0);
  setText(els.headerTotals.totalUsers, summary.uniqueAssignees || 0);
  const completion = summary.completionRate != null ? `${summary.completionRate}%` : '0%';
  setText(els.headerTotals.completionRate, completion);
  setText(els.stats.completed, summary.completedTasks || 0);
  setText(els.stats.pending, summary.pendingTasks || 0);
  setText(els.stats.month, summary.currentMonthTasks || 0);
  setText(els.stats.completionRate, completion);
}

function renderUpcomingTasks(list){
  if (!els.taskCardsContainer) return;
  if (!state.isLoggedIn){
    els.taskCardsContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-dashed border-blue-200 text-center text-sm text-gray-500">
        เข้าสู่ระบบผ่าน LINE เพื่อดูรายละเอียดงานที่กำลังจะถึง
      </div>
    `;
    return;
  }
  if (!list.length){
    els.taskCardsContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center text-sm text-gray-500">
        ไม่พบงานที่กำลังจะถึงในช่วง ${state.upcomingDays} วัน
      </div>
    `;
    return;
  }
  const html = list.map(task=>{
    return `
      <div class="task-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div class="flex justify-between items-start">
          <h3 class="text-base font-semibold text-gray-800">${escapeHtml(task.name)}</h3>
          <span class="text-xs font-medium px-2 py-1 rounded-full ${task.daysUntilDue==='0' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}">
            ${task.daysUntilDue==='0' ? 'วันนี้' : `อีก ${task.daysUntilDue} วัน`}
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-1">${escapeHtml(task.assignee)}</p>
        <div class="flex items-center justify-between mt-3 text-sm text-gray-600">
          <span class="flex items-center space-x-1">
            <span class="material-icons text-base text-blue-500">event</span>
            <span>${escapeHtml(task.dueDateThai || task.dueDate || '')}</span>
          </span>
          <span class="flex items-center space-x-1">
            <span class="material-icons text-base text-green-500">flag</span>
            <span>${escapeHtml(task.status || task.completed || '')}</span>
          </span>
        </div>
      </div>
    `;
  }).join('');
  els.taskCardsContainer.innerHTML = html;
  setText(els.notificationCount, list.length);
}

function renderTasks(tasks){
  if (!els.allTasksContainer) return;
  if (!state.isLoggedIn){
    els.allTasksContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-blue-200 text-center text-sm text-gray-500">
        เข้าสู่ระบบเพื่อดูรายการงานทั้งหมด
      </div>
    `;
    return;
  }
  if (!tasks.length){
    els.allTasksContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center text-sm text-gray-500">
        ไม่พบงานในระบบ
      </div>
    `;
    return;
  }
  const html = tasks.map(task=>{
    const statusClass = task.completed === 'Yes' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600';
    return `
      <div class="task-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-base font-semibold text-gray-800">${escapeHtml(task.name)}</h3>
            <p class="text-sm text-gray-500 mt-1">${escapeHtml(task.assignee || 'ไม่มีผู้รับผิดชอบ')}</p>
          </div>
          <span class="text-xs font-medium px-2 py-1 rounded-full ${statusClass}">
            ${escapeHtml(task.status || (task.completed === 'Yes' ? 'เสร็จสมบูรณ์' : 'รอดำเนินการ'))}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
          <div class="flex items-center space-x-1">
            <span class="material-icons text-base text-blue-500">event</span>
            <span>${escapeHtml(task.dueDate === 'No Due Date' ? 'ไม่มีวันครบกำหนด' : task.dueDate)}</span>
          </div>
          <div class="flex items-center space-x-1">
            <span class="material-icons text-base text-purple-500">link</span>
            <a href="${escapeAttr(task.link)}" target="_blank" class="text-blue-600 hover:underline">เปิดใน Asana</a>
          </div>
        </div>
        <button class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2" data-action="update-status" data-task-id="${escapeAttr(task.id)}">
          <span class="material-icons text-base">edit</span>
          <span>อัปเดตสถานะ</span>
        </button>
      </div>
    `;
  }).join('');
  els.allTasksContainer.innerHTML = html;
}

function renderUserStats(stats){
  if (!els.userStatsContainer) return;
  if (!state.isLoggedIn){
    els.userStatsContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-blue-200 text-center text-sm text-gray-500">
        เข้าสู่ระบบเพื่อดูสถิติรายบุคคล
      </div>
    `;
    return;
  }
  if (!stats.length){
    els.userStatsContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center text-sm text-gray-500">
        ไม่มีสถิติผู้ใช้
      </div>
    `;
    return;
  }
  const html = stats.map((row, index)=>`
    <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">${index+1}</div>
        <div>
          <p class="text-sm font-semibold text-gray-800">${escapeHtml(row.assignee || 'ไม่ทราบชื่อ')}</p>
          <p class="text-xs text-gray-500">${escapeHtml(row.email || '')}</p>
        </div>
      </div>
      <div class="flex space-x-4 text-xs text-gray-600">
        <span>รวม: <strong>${row.totalTasks || 0}</strong></span>
        <span>เสร็จ: <strong class="text-green-600">${row.completedTasks || 0}</strong></span>
        <span>ค้าง: <strong class="text-yellow-600">${row.pendingTasks || 0}</strong></span>
        <span>สำเร็จ: <strong class="text-blue-600">${row.completionRate || 0}%</strong></span>
      </div>
    </div>
  `).join('');
  els.userStatsContainer.innerHTML = html;
}

function renderProfilePage(){
  if (state.isLoggedIn){
    const banner = document.getElementById('loginBanner');
    if (banner && banner.parentNode){
      banner.parentNode.removeChild(banner);
    }
  }
  if (!els.profilePage) return;
  if (!state.isLoggedIn || !state.profile){
    els.profilePage.innerHTML = `
      <div class="bg-white rounded-2xl shadow-md p-6 mb-4">
        <div class="text-center">
          <div class="w-24 h-24 mx-auto bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
            KB
          </div>
          <h2 class="text-xl font-bold text-gray-800 mt-4">KruBoard</h2>
          <p class="text-sm text-gray-500 mt-1">เข้าสู่ระบบด้วย LINE เพื่อจัดการงาน</p>
          <button class="mt-6 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 mx-auto" id="profileLoginBtn">
            <span class="material-icons text-base">chat</span>
            <span>เข้าสู่ระบบผ่าน LINE</span>
          </button>
        </div>
      </div>
    `;
    const loginBtn = document.getElementById('profileLoginBtn');
    if (loginBtn){
      loginBtn.addEventListener('click', ()=>{
        if (typeof liff === 'undefined'){
          toastError('ไม่พบ LIFF SDK');
          return;
        }
        liff.login({ redirectUri: window.location.href });
      });
    }
    return;
  }
  const profile = state.profile;
  els.profilePage.innerHTML = `
    <div class="bg-white rounded-2xl shadow-md p-6 mb-4">
      <div class="flex items-center space-x-4 mb-6">
        <img src="${escapeAttr(profile.pictureUrl || 'https://via.placeholder.com/100x100.png?text=LINE')}" alt="avatar" class="w-20 h-20 rounded-full object-cover border-4 border-blue-100">
        <div>
          <h2 class="text-xl font-bold text-gray-800">${escapeHtml(profile.name || 'ผู้ใช้งาน')}</h2>
          <p class="text-xs text-gray-500">${escapeHtml(profile.email || profile.userId || '')}</p>
          <p class="text-xs text-gray-400">${escapeHtml(profile.statusMessage || '')}</p>
        </div>
      </div>
      <div class="space-y-3">
        <button class="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition" id="btnSetApiKey">
          <div class="flex items-center space-x-3">
            <span class="material-icons text-gray-600">vpn_key</span>
            <span class="text-gray-800">ตั้งค่า API Key สำหรับอัปเดตสถานะ</span>
          </div>
          <span class="material-icons text-gray-400">chevron_right</span>
        </button>
        <button class="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition" id="btnRefreshData">
          <div class="flex items-center space-x-3">
            <span class="material-icons text-gray-600">sync</span>
            <span class="text-gray-800">รีเฟรชข้อมูล</span>
          </div>
          <span class="material-icons text-gray-400">chevron_right</span>
        </button>
      </div>
    </div>
    <button class="w-full bg-red-50 text-red-600 p-4 rounded-xl font-medium hover:bg-red-100 transition flex items-center justify-center space-x-2" id="logoutBtn">
      <span class="material-icons">logout</span>
      <span>ออกจากระบบ</span>
    </button>
  `;
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn){
    logoutBtn.addEventListener('click', ()=>{
      if (typeof liff === 'undefined'){
        toastError('ไม่พบ LIFF SDK');
        return;
      }
      liff.logout();
      localStorage.removeItem('kruboard_api_key');
      state.apiKey = '';
      window.location.reload();
    });
  }
  const btnSetApiKey = document.getElementById('btnSetApiKey');
  if (btnSetApiKey){
    btnSetApiKey.addEventListener('click', ()=>{
      const current = state.apiKey ? '*** ตั้งค่าแล้ว ***' : 'ยังไม่ได้ตั้งค่า';
      const input = prompt(`กรอกรหัส API KEY สำหรับแก้ไขสถานะ\nสถานะปัจจุบัน: ${current}`);
      if (input !== null){
        const trimmed = input.trim();
        if (trimmed){
          state.apiKey = trimmed;
          localStorage.setItem('kruboard_api_key', trimmed);
          toastInfo('บันทึก API Key สำเร็จ');
        } else {
          state.apiKey = '';
          localStorage.removeItem('kruboard_api_key');
          toastInfo('ลบ API Key แล้ว');
        }
      }
    });
  }
  const btnRefreshData = document.getElementById('btnRefreshData');
  if (btnRefreshData){
    btnRefreshData.addEventListener('click', ()=>{
      showLoading(true);
      loadSecureData()
        .finally(()=> showLoading(false));
    });
  }
}

function handleUpdateStatus(taskId){
  if (!state.isLoggedIn){
    toastInfo('ต้องเข้าสู่ระบบก่อน');
    return;
  }
  if (!state.apiKey){
    toastInfo('กรุณาตั้งค่า API Key ในหน้าโปรไฟล์ก่อน');
    return;
  }
  const task = state.tasks.find(t => String(t.id).toUpperCase() === String(taskId).toUpperCase());
  const currentStatus = task?.status || (task?.completed === 'Yes' ? 'เสร็จสมบูรณ์' : 'รอดำเนินการ');
  const newStatus = prompt(`อัปเดตสถานะสำหรับงาน ${taskId}\nสถานะปัจจุบัน: ${currentStatus}\nกรอกสถานะใหม่:`);
  if (newStatus === null) return;
  const trimmed = newStatus.trim();
  if (!trimmed){
    toastInfo('สถานะต้องไม่ว่าง');
    return;
  }
  showLoading(true);
  jsonpRequest({
    action: 'update_status',
    taskId,
    status: trimmed,
    pass: state.apiKey
  }).then(res=>{
    if (!res || res.success === false){
      throw new Error(res?.message || 'update failed');
    }
    toastInfo('อัปเดตสถานะเรียบร้อย');
    return loadSecureData();
  }).catch(err=>{
    handleDataError(err, 'อัปเดตสถานะไม่สำเร็จ');
  }).finally(()=> showLoading(false));
}

function jsonpRequest(params){
  return new Promise((resolve, reject)=>{
    const callbackName = `jsonp_cb_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const query = new URLSearchParams({ ...(params || {}), callback: callbackName });
    const script = document.createElement('script');
    script.src = `${APP_CONFIG.scriptUrl}?${query.toString()}`;
    let timeoutId = setTimeout(()=>{
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 15000);
    function cleanup(){
      clearTimeout(timeoutId);
      delete window[callbackName];
      if (script.parentNode){
        script.parentNode.removeChild(script);
      }
    }
    window[callbackName] = data=>{
      cleanup();
      resolve(data);
    };
    script.onerror = ()=>{
      cleanup();
      const err = new Error('JSONP network error');
      err.code = 'JSONP_NETWORK';
      reject(err);
    };
    document.body.appendChild(script);
  });
}

function setText(el, value){
  if (!el) return;
  el.textContent = value;
}

function escapeHtml(value){
  if (value == null) return '';
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function escapeAttr(value){
  if (value == null) return '';
  return String(value).replace(/"/g, '&quot;');
}
