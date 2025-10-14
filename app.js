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
  personalStats: null,
  currentUser: null,
  notifications: [],
  teachers: [],
  filteredTasks: [],
  taskFilters: { status:'all', search:'' },
  taskPagination: { page:1, pageSize:10, totalPages:1 },
  isAdmin: false,
  apiKey: localStorage.getItem('kruboard_api_key') || ''
};

const THAI_MONTHS = ['เธกเธเธฃเธฒเธเธก','เธเธธเธกเธ เธฒเธเธฑเธเธเน','เธกเธตเธเธฒเธเธก','เน€เธกเธฉเธฒเธขเธ','เธเธคเธฉเธ เธฒเธเธก','เธกเธดเธ–เธธเธเธฒเธขเธ','เธเธฃเธเธเธฒเธเธก','เธชเธดเธเธซเธฒเธเธก','เธเธฑเธเธขเธฒเธขเธ','เธ•เธธเธฅเธฒเธเธก','เธเธคเธจเธเธดเธเธฒเธขเธ','เธเธฑเธเธงเธฒเธเธก'];

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
    completionRate: document.getElementById('headerCompletionRate'),
    myTasks: document.getElementById('headerMyTasks'),
    myUpcoming: document.getElementById('headerMyUpcoming')
  },
  stats: {
    completed: document.getElementById('completedCount'),
    pending: document.getElementById('pendingCount'),
    month: document.getElementById('monthTaskCount'),
    completionRate: document.getElementById('completionRate')
  },
  statsPersonal: {
    container: document.getElementById('personalStatsSection'),
    completed: document.getElementById('myCompletedCount'),
    pending: document.getElementById('myPendingCount'),
    month: document.getElementById('myMonthTaskCount'),
    upcoming: document.getElementById('myUpcomingCount')
  },
  teacherListContainer: document.getElementById('teacherListContainer') || document.getElementById('userStatsContainer'),
  notificationCount: document.getElementById('notificationCount'),
  taskCardsContainer: document.getElementById('taskCardsContainer'),
  allTasksContainer: document.getElementById('allTasksContainer'),
  userStatsContainer: document.getElementById('userStatsContainer'),
  loadingToast: document.getElementById('loadingToast'),
  refreshBtn: document.getElementById('refreshBtn'),
  fabBtn: document.getElementById('fabBtn'),
  timeFilters: Array.from(document.querySelectorAll('.time-filter')),
  nav: Array.from(document.querySelectorAll('.nav-item')),
  notificationBtn: document.getElementById('notificationBtn'),
  taskSearchInput: document.getElementById('taskSearchInput'),
  taskStatusFilter: document.getElementById('taskStatusFilter'),
  taskPaginationPrev: document.getElementById('taskPaginationPrev'),
  taskPaginationNext: document.getElementById('taskPaginationNext'),
  taskPaginationInfo: document.getElementById('taskPaginationInfo'),
  taskPaginationWrapper: document.getElementById('taskPagination'),
  addTaskBtn: document.getElementById('addTaskBtn'),
  addTaskModal: document.getElementById('addTaskModal'),
  addTaskForm: document.getElementById('addTaskForm'),
  addTaskAssignee: document.getElementById('addTaskAssignee'),
  addTaskName: document.getElementById('addTaskName'),
  addTaskDueDate: document.getElementById('addTaskDueDate'),
  addTaskNotes: document.getElementById('addTaskNotes'),
  addTaskCancelBtn: document.getElementById('addTaskCancelBtn'),
  addTaskCloseBtn: document.getElementById('addTaskCloseBtn')
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
          handleDataError(err, 'เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธฅเนเธกเน€เธซเธฅเธง เธเธฃเธธเธ“เธฒเธฅเธญเธเนเธซเธกเน');
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
    console.warn('homePage not found โ€“ layout may be outdated');
  }
}

function bindUI(){
  els.navItems.forEach(item=>{
    item.addEventListener('click', evt=>{
      evt.preventDefault();
      const pageId = item.getAttribute('data-page');
      if (!state.isLoggedIn && pageId !== 'homePage'){
        toastInfo('เธเธฃเธธเธ“เธฒเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเธเนเธฒเธ LINE เน€เธเธทเนเธญเธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”');
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
          toastError('เธฃเธตเน€เธเธฃเธเธเนเธญเธกเธนเธฅเนเธกเนเธชเธณเน€เธฃเนเธ');
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
    els.notificationBtn.addEventListener('click', showNotifications);
  }

  if (els.allTasksContainer){
    els.allTasksContainer.addEventListener('click', evt=>{
      const button = evt.target.closest('[data-action="update-status"]');
      if (!button) return;
      const taskId = button.dataset.taskId;
      handleUpdateStatus(taskId);
    });
  }

  if (els.taskSearchInput){
    els.taskSearchInput.addEventListener('input', ()=>{
      state.taskFilters.search = els.taskSearchInput.value.trim();
      state.taskPagination.page = 1;
      applyTaskFilters();
    });
  }

  if (els.taskStatusFilter){
    els.taskStatusFilter.addEventListener('change', ()=>{
      state.taskFilters.status = els.taskStatusFilter.value;
      state.taskPagination.page = 1;
      applyTaskFilters();
    });
  }

  if (els.taskPaginationPrev){
    els.taskPaginationPrev.addEventListener('click', ()=>{
      if (state.taskPagination.page > 1){
        state.taskPagination.page -= 1;
        renderTaskList();
        renderTaskPagination();
      }
    });
  }

  if (els.taskPaginationNext){
    els.taskPaginationNext.addEventListener('click', ()=>{
      if (state.taskPagination.page < state.taskPagination.totalPages){
        state.taskPagination.page += 1;
        renderTaskList();
        renderTaskPagination();
      }
    });
  }

  if (els.addTaskBtn){
    els.addTaskBtn.addEventListener('click', openAddTaskModal);
  }
  if (els.addTaskForm){
    els.addTaskForm.addEventListener('submit', submitAddTaskForm);
  }
  if (els.addTaskCancelBtn){
    els.addTaskCancelBtn.addEventListener('click', function(event){
      event.preventDefault();
      closeAddTaskModal();
    });
  }
  if (els.addTaskCloseBtn){
    els.addTaskCloseBtn.addEventListener('click', closeAddTaskModal);
  }
  if (els.addTaskModal){
    els.addTaskModal.addEventListener('click', function(event){
      if (event.target === els.addTaskModal){
        closeAddTaskModal();
      }
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
    script.onerror = ()=> reject(new Error('เนเธซเธฅเธ” LIFF SDK เนเธกเนเธชเธณเน€เธฃเนเธ'));
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
        <h2 class="text-base font-semibold text-gray-800">เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเธเนเธฒเธ LINE</h2>
        <p class="text-sm text-gray-500">เธฅเนเธญเธเธญเธดเธเน€เธเธทเนเธญเธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฒเธเนเธฅเธฐเธญเธฑเธเน€เธ”เธ•เธชเธ–เธฒเธเธฐ</p>
      </div>
      <button class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2" id="loginWithLineBtn">
        <span class="material-icons text-base">chat</span>
        <span>เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธ</span>
      </button>
    </div>
  `;
  const loginBtn = document.getElementById('loginWithLineBtn');
  if (loginBtn){
    loginBtn.addEventListener('click', ()=>{
      if (typeof liff === 'undefined'){
        toastError('เนเธกเนเธเธ LIFF SDK');
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
    toastError('เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เน€เธเธทเนเธญเธกเธ•เนเธญ Apps Script เนเธ”เน เนเธเธฃเธ”เธ•เธฃเธงเธเธชเธญเธเธงเนเธฒเน€เธงเนเธเนเธญเธเน€เธเธขเนเธเธฃเนเนเธเธ Anyone เนเธฅเธฐ URL เธ–เธนเธเธ•เนเธญเธ');
  } else {
    toastError(fallbackMessage);
  }
}

async function loadPublicData(){
  const dashboardPromise = fetchDashboardStats();
  const upcomingPromise = loadUpcomingTasks();
  const dashboard = await dashboardPromise;
  renderDashboard(dashboard);
  await upcomingPromise;
}

function fetchDashboardStats(){
  const payload = { action:'dashboard' };
  if (state.isLoggedIn && state.profile?.idToken){
    payload.idToken = state.profile.idToken;
  }
  return jsonpRequest(payload)
    .then(res=>{
      if (!res || res.success === false){
        throw new Error(res?.message || 'dashboard error');
      }
      return res.data || {};
    });
}

function loadUpcomingTasks(){
  const payload = {
    action:'upcoming',
    days: state.upcomingDays
  };
  if (state.isLoggedIn){
    payload.scope = 'mine';
    if (state.profile?.idToken){
      payload.idToken = state.profile.idToken;
    }
  }
  return jsonpRequest(payload)
    .then(res=>{
      if (!res || res.success === false){
        throw new Error(res?.message || 'upcoming error');
      }
      const data = Array.isArray(res.data) ? res.data : [];
      const personal = state.isLoggedIn;
      state.notifications = personal ? data : [];
      setText(els.notificationCount, personal ? (data.length || 0) : 0);
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
    fetchUserStats(),
    fetchActiveTeachers()
  ]).then(([tasksResult, stats, teachers])=>{
    state.tasks = tasksResult.tasks || [];
    if (tasksResult.currentUser){
      state.currentUser = tasksResult.currentUser;
      state.isAdmin = String(state.currentUser.level || '').trim().toLowerCase() === 'admin';
    }
    state.userStats = stats;
    state.teachers = Array.isArray(teachers) ? teachers : [];
    renderTasks(state.tasks);
    renderUserStats(stats);
    updateAdminUI();
  }).catch(err=>{
    handleDataError(err, 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเนเธเธเธฅเธฐเน€เธญเธตเธขเธ”เนเธ”เน');
  });
}

function fetchAllTasks(){
  return jsonpRequest({
    action:'tasks',
    scope:'mine',
    idToken: state.profile?.idToken || ''
  })
    .then(res=>{
      if (!res || res.success === false){
        throw new Error(res?.message || 'tasks error');
      }
      return {
        tasks: Array.isArray(res.data) ? res.data : [],
        currentUser: res.currentUser || null
      };
    });
}

function fetchUserStats(){
  return jsonpRequest({
    action:'user_stats',
    idToken: state.profile?.idToken || ''
  })
    .then(res=>{
      if (!res || res.success === false){
        throw new Error(res?.message || 'user stats error');
      }
      return Array.isArray(res.data) ? res.data : [];
    });
}

function fetchActiveTeachers(){
  return jsonpRequest({
    action:'users',
    idToken: state.profile?.idToken || ''
  }).then(res=>{
    if (!res || res.success === false){
      throw new Error(res?.message || 'users error');
    }
    if (res.currentUser && !state.currentUser){
      state.currentUser = res.currentUser;
      state.isAdmin = String(state.currentUser.level || '').trim().toLowerCase() === 'admin';
    }
    return Array.isArray(res.data) ? res.data : [];
  });
}

function renderDashboard(data){
  state.dashboard = data || null;
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

  state.personalStats = data?.personal || null;
  if (data?.currentUser){
    state.currentUser = data.currentUser;
  }
  state.isAdmin = state.currentUser ? String(state.currentUser.level || '').trim().toLowerCase() === 'admin' : state.isAdmin;
  updateAdminUI();

  if (els.statsPersonal.container){
    if (state.personalStats){
      els.statsPersonal.container.classList.remove('hidden');
      setText(els.headerTotals.myTasks, state.personalStats.totalTasks || 0);
      setText(els.headerTotals.myUpcoming, state.personalStats.upcomingTasks || 0);
      setText(els.statsPersonal.completed, state.personalStats.completedTasks || 0);
      setText(els.statsPersonal.pending, state.personalStats.pendingTasks || 0);
      setText(els.statsPersonal.month, state.personalStats.currentMonthTasks || 0);
      setText(els.statsPersonal.upcoming, state.personalStats.upcomingTasks || 0);
    } else {
      els.statsPersonal.container.classList.add('hidden');
      setText(els.headerTotals.myTasks, '-');
      setText(els.headerTotals.myUpcoming, '-');
    }
  }

  if (!state.personalStats){
    setText(els.headerTotals.myTasks, state.isLoggedIn ? '0' : '-');
    setText(els.headerTotals.myUpcoming, state.isLoggedIn ? '0' : '-');
  }
}

function renderUpcomingTasks(list){
  if (!els.taskCardsContainer) return;
  if (els.headerTotals.myUpcoming){
    if (state.isLoggedIn){
      setText(els.headerTotals.myUpcoming, list.length || 0);
    } else if (!state.personalStats){
      setText(els.headerTotals.myUpcoming, '-');
    }
  }
  if (!state.isLoggedIn){
    els.taskCardsContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-dashed border-blue-200 text-center text-sm text-gray-500">
        เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเธเนเธฒเธ LINE เน€เธเธทเนเธญเธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฒเธเธ—เธตเนเธเธณเธฅเธฑเธเธเธฐเธ–เธถเธ
      </div>
    `;
    return;
  }
  if (!list.length){
    els.taskCardsContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center text-sm text-gray-500">
        เนเธกเนเธเธเธเธฒเธเธ—เธตเนเธเธณเธฅเธฑเธเธเธฐเธ–เธถเธเนเธเธเนเธงเธ ${state.upcomingDays} เธงเธฑเธ
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
            ${task.daysUntilDue==='0' ? 'เธงเธฑเธเธเธตเน' : `เธญเธตเธ ${task.daysUntilDue} เธงเธฑเธ`}
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
        เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเน€เธเธทเนเธญเธ”เธนเธฃเธฒเธขเธเธฒเธฃเธเธฒเธเธ—เธฑเนเธเธซเธกเธ”
      </div>
    `;
    return;
  }
  state.tasks = Array.isArray(tasks) ? tasks.slice() : [];
  state.taskFilters = state.taskFilters || { status:'all', search:'' };
  state.taskPagination = state.taskPagination || { page:1, pageSize:10, totalPages:1 };
  state.taskPagination.page = 1;
  applyTaskFilters();
}

function applyTaskFilters(){
  if (!els.allTasksContainer) return;
  if (!state.isLoggedIn){
    els.allTasksContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-blue-200 text-center text-sm text-gray-500">
        เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเน€เธเธทเนเธญเธ”เธนเธฃเธฒเธขเธเธฒเธฃเธเธฒเธเธ—เธฑเนเธเธซเธกเธ”
      </div>
    `;
    return;
  }
  const tasks = state.tasks || [];
  const search = String(state.taskFilters.search || '').trim().toLowerCase();
  const status = String(state.taskFilters.status || 'all').toLowerCase();

  const filtered = tasks.filter(task=>{
    const isCompleted = task.completed === 'Yes';
    if (status === 'completed' && !isCompleted) return false;
    if (status === 'pending' && isCompleted) return false;
    if (!search) return true;
    const haystack = [
      task.name,
      task.assignee,
      task.status,
      task.dueDate,
      task.dueDateThai
    ].map(value=> String(value || '').toLowerCase());
    return haystack.some(text => text.includes(search));
  });

  filtered.sort((a,b)=>{
    const da = parseTaskDue_(a.dueDate);
    const db = parseTaskDue_(b.dueDate);
    if (da === db) return String(a.name || '').localeCompare(String(b.name || ''));
    return db - da;
  });

  state.filteredTasks = filtered;
  if (els.headerTotals.myTasks){
    const totalMine = state.personalStats && typeof state.personalStats.totalTasks === 'number'
      ? state.personalStats.totalTasks
      : state.tasks.length;
    setText(els.headerTotals.myTasks, totalMine);
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.taskPagination.pageSize));
  state.taskPagination.totalPages = totalPages;
  if (state.taskPagination.page > totalPages){
    state.taskPagination.page = totalPages;
  }
  renderTaskList();
  renderTaskPagination();
}

function renderTaskList(){
  if (!els.allTasksContainer) return;
  if (!state.isLoggedIn){
    els.allTasksContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-blue-200 text-center text-sm text-gray-500">
        เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเน€เธเธทเนเธญเธ”เธนเธฃเธฒเธขเธเธฒเธฃเธเธฒเธเธ—เธฑเนเธเธซเธกเธ”
      </div>
    `;
    return;
  }
  if (!state.filteredTasks.length){
    els.allTasksContainer.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center text-sm text-gray-500">
        เนเธกเนเธเธเธเธฒเธเธ—เธตเนเธ•เธฃเธเธเธฑเธเน€เธเธทเนเธญเธเนเธเธเธฒเธฃเธเนเธเธซเธฒ
      </div>
    `;
    return;
  }
  const start = (state.taskPagination.page - 1) * state.taskPagination.pageSize;
  const end = start + state.taskPagination.pageSize;
  const items = state.filteredTasks.slice(start, end);
  const html = items.map(task=>{
    const isCompleted = task.completed === 'Yes';
    const statusLabel = task.status || (isCompleted ? 'เน€เธชเธฃเนเธเธชเธกเธเธนเธฃเธ“เน' : 'เธฃเธญเธ”เธณเน€เธเธดเธเธเธฒเธฃ');
    const statusClass = isCompleted ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600';
    const dueDisplay = toThaiDateLabel(task.dueDate, task.dueDateThai);
    const dueMeta = formatDueMeta_(task.dueDate);
    const buttonClass = isCompleted
      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
      : 'bg-blue-600 hover:bg-blue-700 text-white';
    const buttonLabel = isCompleted ? 'เน€เธชเธฃเนเธเธชเธกเธเธนเธฃเธ“เนเนเธฅเนเธง' : 'เธ—เธณเน€เธเธฃเธทเนเธญเธเธซเธกเธฒเธขเธงเนเธฒเน€เธชเธฃเนเธ';
    const disabledAttr = isCompleted ? 'disabled' : '';
    return `
      <div class="task-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-base font-semibold text-gray-800">${escapeHtml(task.name)}</h3>
            <p class="text-sm text-gray-500 mt-1">${escapeHtml(task.assignee || 'เนเธกเนเธกเธตเธเธนเนเธฃเธฑเธเธเธดเธ”เธเธญเธ')}</p>
          </div>
          <span class="text-xs font-medium px-2 py-1 rounded-full ${statusClass}">
            ${escapeHtml(statusLabel)}
          </span>
        </div>
        <div class="mt-3 text-sm text-gray-600 space-y-1">
          <div class="flex items-center space-x-2">
            <span class="material-icons text-base text-blue-500">event</span>
            <span>${escapeHtml(dueDisplay)}</span>
            <span class="text-xs text-gray-400">${escapeHtml(dueMeta)}</span>
          </div>
          <div class="flex items-center space-x-2 text-xs text-gray-500">
            <span class="material-icons text-base text-purple-500">link</span>
            <a href="${escapeAttr(task.link)}" target="_blank" class="text-blue-600 hover:underline">เน€เธเธดเธ”เนเธ Asana</a>
          </div>
        </div>
        <button class="mt-4 w-full ${buttonClass} py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition" data-action="update-status" data-task-id="${escapeAttr(task.id)}" ${disabledAttr}>
          <span class="material-icons text-base">${isCompleted ? 'task_alt' : 'done'}</span>
          <span>${buttonLabel}</span>
        </button>
      </div>
    `;
  }).join('');
  els.allTasksContainer.innerHTML = html;
}

function renderTaskPagination(){
  if (!els.taskPaginationInfo) return;
  const wrapper = els.taskPaginationWrapper;
  if (wrapper){
    const shouldHide = !state.isLoggedIn || state.filteredTasks.length <= state.taskPagination.pageSize;
    wrapper.classList.toggle('hidden', shouldHide);
  }
  if (!state.filteredTasks.length){
    els.taskPaginationInfo.textContent = 'เนเธกเนเธกเธตเธเธฒเธ';
function buildTeacherAvatar_(teacher){


  if (!teacher) return 'https://ui-avatars.com/api/?name=K&background=2563eb&color=ffffff';


  const src = teacher.lineAvatarThumb || teacher.linePictureUrl || teacher.picture;


  if (src && String(src).trim()) return String(src).trim();


  const fallbackName = (teacher.name || teacher.lineDisplayName || 'ครู').trim();


  const initial = fallbackName ? fallbackName.charAt(0).toUpperCase() : 'K';


  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=2563eb&color=ffffff`;


}


    if (els.taskPaginationPrev) els.taskPaginationPrev.disabled = true;
    if (els.taskPaginationNext) els.taskPaginationNext.disabled = true;
    return;
  }
  const totalPages = state.taskPagination.totalPages || 1;
  const currentPage = state.taskPagination.page || 1;
  els.taskPaginationInfo.textContent = `เธซเธเนเธฒ ${currentPage}/${totalPages}`;
  if (els.taskPaginationPrev) els.taskPaginationPrev.disabled = currentPage <= 1;
  if (els.taskPaginationNext) els.taskPaginationNext.disabled = currentPage >= totalPages;
}

function renderUserStats(){
  renderTeachers();
}

function renderTeachers(){
  const container = els.teacherListContainer || els.userStatsContainer;
  if (!container) return;
  if (!state.isLoggedIn){
    container.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-blue-200 text-center text-sm text-gray-500">
        เข้าสู่ระบบเพื่อดูข้อมูลทีมครู
      </div>
    `;
    return;
  }
  const activeTeachers = (state.teachers || []).filter(t => isActiveStatus(t.status));
  if (!activeTeachers.length){
    container.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center text-sm text-gray-500">
        ยังไม่มีข้อมูลครูที่เปิดใช้งาน
      </div>
    `;
    return;
  }
  const statsByEmail = new Map();
  const statsByName = new Map();
  (state.userStats || []).forEach(stat => {
    const emailKey = normalizeEmail(stat.email);
    if (emailKey) statsByEmail.set(emailKey, stat);
    const nameKey = normalizeName(stat.assignee);
    if (nameKey && !statsByName.has(nameKey)) statsByName.set(nameKey, stat);
  });
  const cards = activeTeachers.map(teacher => {
    const emailKey = normalizeEmail(teacher.email || teacher.user);
    const nameKey = normalizeName(teacher.name || teacher.lineDisplayName);
    const stats = statsByEmail.get(emailKey) || statsByName.get(nameKey) || { totalTasks:0, completedTasks:0, pendingTasks:0, completionRate:0 };
    const completion = stats.completionRate != null ? `${stats.completionRate}%` : '-';
    const avatar = buildTeacherAvatar_(teacher);
    const level = String(teacher.level || 'Teacher').trim();
    const levelBadge = level ? `<span class="text-xs px-2 py-0.5 rounded-full ${level.toLowerCase()==='admin' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}">${escapeHtml(level)}</span>` : '';
    const phoneLine = teacher.phone ? `<div class="flex items-center space-x-2 text-xs text-gray-500"><span class="material-icons text-base text-emerald-500">call</span><a href="tel:${escapeAttr(teacher.phone)}" class="hover:underline">${escapeHtml(teacher.phone)}</a></div>` : '';
    const lineDisplay = teacher.lineDisplayName ? `<div class="flex items-center space-x-2 text-xs text-gray-500"><span class="material-icons text-base text-lime-500">chat</span><span>${escapeHtml(teacher.lineDisplayName)}</span></div>` : '';
    const lineUidRow = teacher.lineUID ? `<span class="flex items-center space-x-1"><span class="material-icons text-sm text-gray-300">badge</span><span>${escapeHtml(teacher.lineUID)}</span></span>` : '<span></span>';
    return `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
        <div class="flex items-center space-x-3">
          <img src="${escapeAttr(avatar)}" alt="${escapeAttr(teacher.name || 'ครู')}" class="w-14 h-14 rounded-full object-cover border-2 border-blue-100">
          <div>
            <div class="flex items-center space-x-2">
              <p class="text-base font-semibold text-gray-800">${escapeHtml(teacher.name || teacher.lineDisplayName || 'ไม่ทราบชื่อ')}</p>
              ${levelBadge}
            </div>
            <p class="text-xs text-gray-500">${escapeHtml(teacher.email || teacher.user || '')}</p>
            ${lineDisplay || phoneLine ? `<div class="mt-1 space-y-1">${lineDisplay}${phoneLine}</div>` : ''}
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-4 text-center">
          <div class="bg-blue-50 rounded-lg p-2">
            <div class="text-xs text-blue-500">รวม</div>
            <div class="text-lg font-semibold text-blue-700">${stats.totalTasks || 0}</div>
          </div>
          <div class="bg-emerald-50 rounded-lg p-2">
            <div class="text-xs text-emerald-500">เสร็จ</div>
            <div class="text-lg font-semibold text-emerald-600">${stats.completedTasks || 0}</div>
          </div>
          <div class="bg-amber-50 rounded-lg p-2">
            <div class="text-xs text-amber-500">ค้าง</div>
            <div class="text-lg font-semibold text-amber-600">${stats.pendingTasks || 0}</div>
          </div>
        </div>
        <div class="mt-4 text-xs text-gray-500 flex items-center justify-between">
          <span class="flex items-center space-x-1"><span class="material-icons text-sm text-purple-500">trending_up</span><span>สำเร็จ: ${completion}</span></span>
          ${lineUidRow}
        </div>
      </div>
    `;
  }).join('');
  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${cards}
    </div>
  `;
}  const activeTeachers = (state.teachers || []).filter(t => isActiveStatus(t.status));
  if (!activeTeachers.length){
    container.innerHTML = `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center text-sm text-gray-500">
        เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเธเธฃเธนเธ—เธตเนเน€เธเธดเธ”เนเธเนเธเธฒเธ
      </div>
    `;
    return;
  }
  const statsByEmail = new Map();
  (state.userStats || []).forEach(stat=>{
    const key = String(stat.email || '').trim().toLowerCase();
    if (key) statsByEmail.set(key, stat);
  });
  const cards = activeTeachers.map(teacher=>{
    const email = String(teacher.email || teacher.user || '').trim().toLowerCase();
    const stats = statsByEmail.get(email) || { totalTasks:0, completedTasks:0, pendingTasks:0, completionRate:0 };
    const completion = stats.completionRate != null ? `${stats.completionRate}%` : '-';
    const avatar = buildTeacherAvatar_(teacher);
    const level = String(teacher.level || 'Teacher').trim();
    const levelBadge = level ? `<span class="text-xs px-2 py-0.5 rounded-full ${level.toLowerCase()==='admin' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}">${escapeHtml(level)}</span>` : '';
    const phoneLine = teacher.phone ? `<div class="flex items-center space-x-2 text-xs text-gray-500"><span class="material-icons text-base text-emerald-500">call</span><a href="tel:${escapeAttr(teacher.phone)}" class="hover:underline">${escapeHtml(teacher.phone)}</a></div>` : '';
    const lineDisplay = teacher.lineDisplayName ? `<div class="flex items-center space-x-2 text-xs text-gray-500"><span class="material-icons text-base text-lime-500">chat</span><span>${escapeHtml(teacher.lineDisplayName)}</span></div>` : '';
    const lineUidRow = teacher.lineUID ? `<span class="flex items-center space-x-1"><span class="material-icons text-sm text-gray-300">badge</span><span>${escapeHtml(teacher.lineUID)}</span></span>` : '<span></span>';
    return `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
        <div class="flex items-center space-x-3">
          <img src="${escapeAttr(avatar)}" alt="${escapeAttr(teacher.name || 'เธเธฃเธน')}" class="w-14 h-14 rounded-full object-cover border-2 border-blue-100">
          <div>
            <div class="flex items-center space-x-2">
              <p class="text-base font-semibold text-gray-800">${escapeHtml(teacher.name || teacher.lineDisplayName || 'เนเธกเนเธ—เธฃเธฒเธเธเธทเนเธญ')}</p>
              ${levelBadge}
            </div>
            <p class="text-xs text-gray-500">${escapeHtml(teacher.email || teacher.user || '')}</p>
            ${lineDisplay || phoneLine ? `<div class="mt-1 space-y-1">${lineDisplay}${phoneLine}</div>` : ''}
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-4 text-center">
          <div class="bg-blue-50 rounded-lg p-2">
            <div class="text-xs text-blue-500">เธฃเธงเธก</div>
            <div class="text-lg font-semibold text-blue-700">${stats.totalTasks || 0}</div>
          </div>
          <div class="bg-emerald-50 rounded-lg p-2">
            <div class="text-xs text-emerald-500">เน€เธชเธฃเนเธ</div>
            <div class="text-lg font-semibold text-emerald-600">${stats.completedTasks || 0}</div>
          </div>
          <div class="bg-amber-50 rounded-lg p-2">
            <div class="text-xs text-amber-500">เธเนเธฒเธ</div>
            <div class="text-lg font-semibold text-amber-600">${stats.pendingTasks || 0}</div>
          </div>
        </div>
        <div class="mt-4 text-xs text-gray-500 flex items-center justify-between">
          <span class="flex items-center space-x-1"><span class="material-icons text-sm text-purple-500">trending_up</span><span>เธชเธณเน€เธฃเนเธ: ${completion}</span></span>
          ${lineUidRow}
        </div>
      </div>
    `;
  }).join('');
  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${cards}
    </div>
  `;
}

function parseTaskDue_(value){
  if (!value || value === 'No Due Date') return Number.MIN_SAFE_INTEGER;
  const iso = value.includes('T') ? value : `${value}T00:00:00+07:00`;
  const date = new Date(iso);
  if (isNaN(date)) return Number.MIN_SAFE_INTEGER;
  return date.getTime();
}

function formatDueMeta_(dueDate){
  if (!dueDate || dueDate === 'No Due Date') return '';
  const iso = dueDate.includes('T') ? dueDate : `${dueDate}T00:00:00+07:00`;
  const due = new Date(iso);
  if (isNaN(due)) return '';
  const today = new Date();
  today.setHours(0,0,0,0);
  due.setHours(0,0,0,0);
  const diff = Math.round((due - today)/(24*60*60*1000));
  if (diff === 0) return 'เธเธฃเธเธเธณเธซเธเธ”เธงเธฑเธเธเธตเน';
  if (diff > 0) return `เน€เธซเธฅเธทเธญเธญเธตเธ ${diff} เธงเธฑเธ`;
  return `เน€เธเธดเธเธเธณเธซเธเธ” ${Math.abs(diff)} เธงเธฑเธ`;
}

function updateAdminUI(){
  if (els.addTaskBtn){
    if (state.isLoggedIn && state.isAdmin){
      els.addTaskBtn.classList.remove('hidden');
    } else {
      els.addTaskBtn.classList.add('hidden');
    }
  }
}

function showNotifications(){
  if (!state.isLoggedIn){
    toastInfo('เธเธฃเธธเธ“เธฒเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเน€เธเธทเนเธญเธ”เธนเธเธฒเธฃเนเธเนเธเน€เธ•เธทเธญเธ');
    return;
  }
  if (!state.notifications.length){
    toastInfo('เธขเธฑเธเนเธกเนเธกเธตเธเธฒเธฃเนเธเนเธเน€เธ•เธทเธญเธเนเธซเธกเน');
    return;
  }
  const lines = state.notifications.slice(0, 5).map(task=>{
    const due = task.dueDateThai || task.dueDate || 'เนเธกเนเธกเธตเธงเธฑเธเธเธฃเธเธเธณเธซเธเธ”';
    const meta = formatDueMeta_(task.dueDate);
    return `โ€ข ${task.name} (${due}${meta ? ' โ€ข '+meta : ''})`;
  });
  const remaining = state.notifications.length - lines.length;
  const message = lines.join('\n') + (remaining > 0 ? `\nโ€ฆ เนเธฅเธฐเธญเธตเธ ${remaining} เธเธฒเธ` : '');
  alert(`เธเธฒเธเธ—เธตเนเธเธณเธฅเธฑเธเธเธฐเธ–เธถเธเธเธณเธซเธเธ”:\n${message}`);
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
          <p class="text-sm text-gray-500 mt-1">เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเธ”เนเธงเธข LINE เน€เธเธทเนเธญเธเธฑเธ”เธเธฒเธฃเธเธฒเธ</p>
          <button class="mt-6 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 mx-auto" id="profileLoginBtn">
            <span class="material-icons text-base">chat</span>
            <span>เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเธเนเธฒเธ LINE</span>
          </button>
        </div>
      </div>
    `;
    const loginBtn = document.getElementById('profileLoginBtn');
    if (loginBtn){
      loginBtn.addEventListener('click', ()=>{
        if (typeof liff === 'undefined'){
          toastError('เนเธกเนเธเธ LIFF SDK');
          return;
        }
        liff.login({ redirectUri: window.location.href });
      });
    }
    return;
  }
  const profile = state.profile;
  const userRecord = state.currentUser || {};
  const roleLabel = userRecord.level ? String(userRecord.level) : (state.isAdmin ? 'Admin' : 'เธเธฃเธน');
  const lineUidLabel = userRecord.lineUID ? `LINE UID: ${userRecord.lineUID}` : '';
  els.profilePage.innerHTML = `
    <div class="bg-white rounded-2xl shadow-md p-6 mb-4">
      <div class="flex items-center space-x-4 mb-6">
        <img src="${escapeAttr(profile.pictureUrl || 'https://via.placeholder.com/100x100.png?text=LINE')}" alt="avatar" class="w-20 h-20 rounded-full object-cover border-4 border-blue-100">
        <div>
          <h2 class="text-xl font-bold text-gray-800">${escapeHtml(profile.name || 'เธเธนเนเนเธเนเธเธฒเธ')}</h2>
          <p class="text-xs text-gray-500">${escapeHtml(profile.email || profile.userId || '')}</p>
          <p class="text-xs text-emerald-600 font-semibold mt-1">เธเธ—เธเธฒเธ—: ${escapeHtml(roleLabel)}</p>
          ${lineUidLabel ? `<p class="text-xs text-gray-400">${escapeHtml(lineUidLabel)}</p>` : ''}
          <p class="text-xs text-gray-400 mt-1">${escapeHtml(profile.statusMessage || '')}</p>
        </div>
      </div>
      <div class="space-y-3">
        <button class="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition" id="btnSetApiKey">
          <div class="flex items-center space-x-3">
            <span class="material-icons text-gray-600">vpn_key</span>
            <span class="text-gray-800">เธ•เธฑเนเธเธเนเธฒ API Key (เธเธนเนเธ”เธนเนเธฅเธฃเธฐเธเธ)</span>
          </div>
          <span class="material-icons text-gray-400">chevron_right</span>
        </button>
        <button class="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition" id="btnRefreshData">
          <div class="flex items-center space-x-3">
            <span class="material-icons text-gray-600">sync</span>
            <span class="text-gray-800">เธฃเธตเน€เธเธฃเธเธเนเธญเธกเธนเธฅ</span>
          </div>
          <span class="material-icons text-gray-400">chevron_right</span>
        </button>
      </div>
    </div>
    <button class="w-full bg-red-50 text-red-600 p-4 rounded-xl font-medium hover:bg-red-100 transition flex items-center justify-center space-x-2" id="logoutBtn">
      <span class="material-icons">logout</span>
      <span>เธญเธญเธเธเธฒเธเธฃเธฐเธเธ</span>
    </button>
  `;
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn){
    logoutBtn.addEventListener('click', ()=>{
      if (typeof liff === 'undefined'){
        toastError('เนเธกเนเธเธ LIFF SDK');
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
    if (!state.isAdmin){
      btnSetApiKey.classList.add('hidden');
    }else{
      btnSetApiKey.classList.remove('hidden');
    }
    btnSetApiKey.addEventListener('click', ()=>{
      const current = state.apiKey ? '*** เธ•เธฑเนเธเธเนเธฒเนเธฅเนเธง ***' : 'เธขเธฑเธเนเธกเนเนเธ”เนเธ•เธฑเนเธเธเนเธฒ';
      const input = prompt(`เธเธฃเธญเธเธฃเธซเธฑเธช API KEY เธชเธณเธซเธฃเธฑเธเนเธเนเนเธเธชเธ–เธฒเธเธฐ\nเธชเธ–เธฒเธเธฐเธเธฑเธเธเธธเธเธฑเธ: ${current}`);
      if (input !== null){
        const trimmed = input.trim();
        if (trimmed){
          state.apiKey = trimmed;
          localStorage.setItem('kruboard_api_key', trimmed);
          toastInfo('เธเธฑเธเธ—เธถเธ API Key เธชเธณเน€เธฃเนเธ');
        } else {
          state.apiKey = '';
          localStorage.removeItem('kruboard_api_key');
          toastInfo('เธฅเธ API Key เนเธฅเนเธง');
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
  updateAdminUI();
}

function handleUpdateStatus(taskId){
  if (!state.isLoggedIn){
    toastInfo('เธ•เนเธญเธเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเธเนเธญเธ');
    return;
  }
  const task = state.tasks.find(t => String(t.id).toUpperCase() === String(taskId).toUpperCase());
  if (!task){
    toastInfo('เนเธกเนเธเธเธเธฒเธเธ—เธตเนเน€เธฅเธทเธญเธ');
    return;
  }
  if (task.completed === 'Yes'){
    toastInfo('เธเธฒเธเธเธตเนเธ—เธณเน€เธชเธฃเนเธเนเธฅเนเธง');
    return;
  }
  const currentStatus = task?.status || (task?.completed === 'Yes' ? 'เน€เธชเธฃเนเธเธชเธกเธเธนเธฃเธ“เน' : 'เธฃเธญเธ”เธณเน€เธเธดเธเธเธฒเธฃ');
  const confirmDone = confirm(`เธขเธทเธเธขเธฑเธเธ—เธณเน€เธเธฃเธทเนเธญเธเธซเธกเธฒเธขเธงเนเธฒเธเธฒเธ "${task.name}" เน€เธชเธฃเนเธเธชเธกเธเธนเธฃเธ“เนเธซเธฃเธทเธญเนเธกเน?\nเธชเธ–เธฒเธเธฐเธเธฑเธเธเธธเธเธฑเธ: ${currentStatus}`);
  if (!confirmDone) return;
  showLoading(true);
  jsonpRequest({
    action: 'update_status',
    taskId,
    status: 'เน€เธชเธฃเนเธเธชเธกเธเธนเธฃเธ“เน',
    idToken: state.profile?.idToken || ''
  }).then(res=>{
    if (!res || res.success === false){
      throw new Error(res?.message || 'update failed');
    }
    toastInfo('เธญเธฑเธเน€เธ”เธ•เธชเธ–เธฒเธเธฐเน€เธฃเธตเธขเธเธฃเนเธญเธข');
    return Promise.all([loadSecureData(), loadPublicData()]);
  }).catch(err=>{
    handleDataError(err, 'เธญเธฑเธเน€เธ”เธ•เธชเธ–เธฒเธเธฐเนเธกเนเธชเธณเน€เธฃเนเธ');
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
  const normalized = normalizeStatus(value);
  return normalized === ''active'' || normalized === ''เปิดใช้งาน'' || normalized === ''ใช้งาน'';
}





  const normalized = normalizeStatus(value);
  return normalized === 'active' || normalized === 'เปิดใช้งาน' || normalized === 'ใช้งาน';
}
  const normalized = normalizeStatus(value);
  return normalized === 'active' || normalized === 'เปิดใช้งาน' || normalized === 'ใช้งาน';
}

function openAddTaskModal(){
  if (!state.isAdmin){
    toastInfo('ฟีเจอร์นี้สำหรับผู้ดูแลระบบ');
    return;
  }
  populateAssigneeOptions();
  resetAddTaskForm();
  if (!els.addTaskModal) return;
  els.addTaskModal.classList.remove('hidden');
  els.addTaskModal.classList.add('flex');
}

function closeAddTaskModal(){
  if (!els.addTaskModal) return;
  els.addTaskModal.classList.add('hidden');
  els.addTaskModal.classList.remove('flex');
}

function resetAddTaskForm(){
  if (els.addTaskForm){
    els.addTaskForm.reset();
  }
}

function populateAssigneeOptions(){
  if (!els.addTaskAssignee) return;
  const teachers = (state.teachers || []).filter(t => isActiveStatus(t.status));
  const options = ['<option value="">เลือกผู้รับผิดชอบ</option>'];
  teachers.sort((a,b)=> String(a.name || '').localeCompare(String(b.name || '')));
  if (!teachers.length){
    options.push('<option value="">(ยังไม่มีรายชื่อครูในระบบ)</option>');
  }
  teachers.forEach(teacher=>{
    const email = (teacher.email || teacher.user || '').trim();
    const label = teacher.name || teacher.lineDisplayName || email || 'ไม่ทราบชื่อ';
    const safeEmail = escapeAttr(email);
    const safeLabel = escapeHtml(label);
    options.push(`<option value="${safeEmail}">${safeLabel}</option>`);
  });
  els.addTaskAssignee.innerHTML = options.join('');
}

function submitAddTaskForm(event){
  event.preventDefault();
  if (!state.isAdmin){
    toastInfo('ฟีเจอร์นี้สำหรับผู้ดูแลระบบ');
    return;
  }
  const name = (els.addTaskName?.value || '').trim();
  if (!name){
    toastInfo('กรุณากรอกชื่องาน');
    return;
  }
  const assigneeEmail = (els.addTaskAssignee?.value || '').trim();
  const dueDate = (els.addTaskDueDate?.value || '').trim();
  const notes = (els.addTaskNotes?.value || '').trim();
  showLoading(true);
  jsonpRequest({
    action:'asana_create_task',
    name,
    assigneeEmail,
    dueDate,
    notes,
    idToken: state.profile?.idToken || '',
    pass: state.apiKey || ''
  }).then(res=>{
    if (!res || res.success === false){
      throw new Error(res?.message || 'create task error');
    }
    toastInfo('สร้างงานใหม่สำเร็จ');
    closeAddTaskModal();
    return Promise.all([loadSecureData(), loadPublicData()]);
  }).catch(err=>{
    handleDataError(err, 'ไม่สามารถสร้างงานใหม่ได้');
  }).finally(()=> showLoading(false));
}

function toThaiDateLabel(value, fallbackThai){
  if (fallbackThai && fallbackThai !== 'No Due Date') return fallbackThai;
  if (!value || value === 'No Due Date') return 'ไม่มีวันครบกำหนด';
  const iso = value.includes('T') ? value : `${value}T00:00:00+07:00`;
  const date = new Date(iso);
  if (isNaN(date)) return fallbackThai || value;
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear()+543}`;
}

function normalizeStatus(value){
  return String(value || '').trim().toLowerCase();
}

function isActiveStatus(value){
  const normalized = normalizeStatus(value);
  return normalized === 'active' || normalized === 'เปิดใช้งาน' || normalized === 'ใช้งาน';
}






function normalizeEmail(value){
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value){
  return String(value || '').trim().toLowerCase();
}
