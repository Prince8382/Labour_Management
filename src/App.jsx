import { useCallback, useEffect, useMemo, useState } from "react";

const today = new Date();
const toDateInput = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const todayString = toDateInput(today);
const monthString = todayString.slice(0, 7);
const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);


const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new Error(
      `API se connection nahi ho pa raha (${API_URL || window.location.origin}${path}). API server, CORS settings, aur deployment URL check karein.`,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `${options?.method || "GET"} ${path} failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}


const navItems = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "labours", label: "Labour", icon: "♙" },
  { id: "attendance", label: "Attendance", icon: "▦" },
  { id: "salary", label: "Salary & Payments", icon: "₹" },
];

const statusNames = {
  present: "Present",
  absent: "Absent",
  "half-day": "Half day",
  leave: "Leave",
};

function App() {
  const [page, setPage] = useState("overview");
  const [labours, setLabours] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceRevision, setAttendanceRevision] = useState(0);
  const [attendanceSummary, setAttendanceSummary] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(todayString);
  const [attendanceMonth, setAttendanceMonth] = useState(monthString);
  const [salaryMonth, setSalaryMonth] = useState(monthString);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState("checking");
  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState("");
  const [selectedLabour, setSelectedLabour] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [labourData, attendanceData, attendanceSummaryData, salaryData] = await Promise.all([
        request("/api/labours"),
        request(`/api/attendance?date=${attendanceDate}`),
        request(`/api/attendance/summary?month=${attendanceMonth}`),
        request(`/api/salaries?month=${salaryMonth}`),
      ]);
      setLabours(labourData);
      setAttendance(attendanceData);
      setAttendanceRevision((revision) => revision + 1);
      setAttendanceSummary(attendanceSummaryData);
      setSalaries(salaryData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [attendanceDate, attendanceMonth, salaryMonth]);

  useEffect(() => {
    request("/api/auth/me")
      .then((user) => {
        setUsername(user.username);
        setAuthStatus("authenticated");
      })
      .catch((authRequestError) => {
        if (authRequestError.status !== 401) setAuthError(authRequestError.message);
        setAuthStatus("unauthenticated");
      });
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") loadData();
  }, [authStatus, loadData]);

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");
    const form = new FormData(event.currentTarget);
    const nextUsername = String(form.get("username") || "");
    const password = String(form.get("password") || "");
    if (authMode === "signup" && password !== form.get("confirmPassword")) {
      setAuthError("Passwords do not match.");
      return;
    }
    try {
      const user = await request(`/api/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify({ username: nextUsername, password }),
      });
      setUsername(user.username);
      setAuthStatus("authenticated");
    } catch (requestError) {
      setAuthError(requestError.message);
    }
  }

  async function logout() {
    try {
      await request("/api/auth/logout", { method: "POST" });
      setLabours([]);
      setAttendance([]);
      setAttendanceSummary([]);
      setSalaries([]);
      setAuthStatus("unauthenticated");
      setAuthMode("login");
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  const activeLabours = labours.filter((labour) => labour.status === "active");
  const markedAttendance = useMemo(
    () => new Map(attendance.map((record) => [String(record.labour), record])),
    [attendance],
  );
  const attendanceCounts = useMemo(
    () =>
      attendance.reduce(
        (counts, record) => ({ ...counts, [record.status]: (counts[record.status] || 0) + 1 }),
        {},
      ),
    [attendance],
  );
  const salaryTotals = useMemo(
    () =>
      salaries.reduce(
        (totals, item) => ({
          earned: totals.earned + item.earned,
          paid: totals.paid + item.paid,
          balance: totals.balance + item.balance,
        }),
        { earned: 0, paid: 0, balance: 0 },
      ),
    [salaries],
  );

  async function submitLabour(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.dailyWage = Number(payload.dailyWage);
    try {
      await request("/api/labours", { method: "POST", body: JSON.stringify(payload) });
      setModal("");
      setNotice("Labour details added successfully.");
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function saveAttendance(event) {
    event.preventDefault();
    const entries = activeLabours.map((labour) => {
      const status = event.currentTarget.elements[`status-${labour._id}`]?.value || "present";
      const overtimeHours = event.currentTarget.elements[`overtime-${labour._id}`]?.value || 0;
      return { labourId: labour._id, status, overtimeHours: Number(overtimeHours) };
    });
    try {
      await request("/api/attendance/bulk", {
        method: "PUT",
        body: JSON.stringify({ date: attendanceDate, entries }),
      });
      setNotice("Attendance saved for " + activeLabours.length + " labourers.");
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.amount = Number(payload.amount);
    try {
      await request("/api/salaries/payments", { method: "POST", body: JSON.stringify(payload) });
      setModal("");
      setNotice("Payment recorded successfully.");
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function toggleLabourStatus(labour) {
    try {
      await request(`/api/labours/${labour._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: labour.status === "active" ? "inactive" : "active" }),
      });
      setNotice(`${labour.fullName} marked ${labour.status === "active" ? "inactive" : "active"}.`);
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function deleteLabour(labour) {
    const confirmed = window.confirm(
      `Permanently delete ${labour.fullName}? This also deletes all their attendance and payment history and cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await request(`/api/labours/${labour._id}`, { method: "DELETE" });
      setNotice(`${labour.fullName} and their related records were deleted.`);
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  if (authStatus !== "authenticated") {
    return (
      <AuthPage
        mode={authMode}
        checking={authStatus === "checking"}
        username={username}
        error={authError}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError("");
        }}
        onSubmit={submitAuth}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setPage("overview")}>
          <span className="brand-mark" aria-hidden="true">AY</span>
          <span><strong>Amit Yadav</strong><small>LABOUR MANAGER</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={`nav-item ${page === item.id ? "selected" : ""}`}
              key={item.id}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>{item.label}
              {page === item.id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">?</span>
            <strong>Need a hand?</strong>
            <p>Keep your team organized with Amit Yadav Labour Manager.</p>
          </div>
          <div className="profile">
            <div className="avatar">{username.slice(0, 1).toUpperCase()}</div>
            <div><strong>{username}</strong><small>Manager</small></div>
            <span className="profile-more">···</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{navItems.find((item) => item.id === page)?.label}</strong></div>
          <div className="topbar-right">
            <span className="today-label">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
            <button className="icon-button" aria-label="Notifications">♧<i /></button>
            <button className="logout-button" onClick={logout}>Log out</button>
            <div className="top-avatar">{username.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <section className="page-content">
          {error && <div className="alert error-alert"><span>!</span><div><strong>Something went wrong</strong><p>{error}</p></div><button onClick={() => setError("")}>×</button></div>}
          {notice && <div className="alert success-alert"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}
          {loading && <div className="loading-bar" aria-label="Loading data" />}

          {page === "overview" && (
            <Overview
              activeLabours={activeLabours}
              attendanceCounts={attendanceCounts}
              attendanceDate={attendanceDate}
              markedAttendance={markedAttendance}
              salaries={salaries}
              salaryTotals={salaryTotals}
              setPage={setPage}
              setAttendanceDate={setAttendanceDate}
              showNotice={showNotice}
              username={username}
            />
          )}
          {page === "labours" && (
            <LabourPage labours={labours} onAdd={() => setModal("labour")} onToggleStatus={toggleLabourStatus} onDelete={deleteLabour} />
          )}
          {page === "attendance" && (
            <AttendancePage
              labours={activeLabours}
              markedAttendance={markedAttendance}
              attendanceRevision={attendanceRevision}
              summary={attendanceSummary}
              date={attendanceDate}
              setDate={setAttendanceDate}
              month={attendanceMonth}
              setMonth={setAttendanceMonth}
              onSave={saveAttendance}
              onGoToLabours={() => setPage("labours")}
            />
          )}
          {page === "salary" && (
            <SalaryPage
              salaries={salaries}
              totals={salaryTotals}
              month={salaryMonth}
              setMonth={setSalaryMonth}
              onPay={(labourId) => {
                setSelectedLabour(labourId);
                setModal("payment");
              }}
            />
          )}
        </section>
      </main>

      {modal === "labour" && <Modal title="Add new labour" onClose={() => setModal("")}>
        <form className="form-grid" onSubmit={submitLabour}>
          <label>Full name<input name="fullName" placeholder="e.g. Ramesh Kumar" required maxLength="100" /></label>
          <label>Phone number<input name="phone" type="tel" placeholder="10-digit mobile number" required maxLength="20" /></label>
          <label>Work / role<input name="role" placeholder="e.g. Mason, Helper" required maxLength="80" /></label>
          <label>Daily wage (₹)<input name="dailyWage" type="number" min="0" step="1" placeholder="700" required /></label>
          <label>Joining date<input name="joiningDate" type="date" defaultValue={todayString} required /></label>
          <label>Emergency contact<input name="emergencyContact" type="tel" placeholder="Optional" maxLength="20" /></label>
          <label className="full-width">Address<input name="address" placeholder="Village, city or address" maxLength="300" /></label>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setModal("")}>Cancel</button><button className="button primary">Add labour</button></div>
        </form>
      </Modal>}

      {modal === "payment" && <Modal title="Record salary payment" onClose={() => setModal("")}>
        <form className="form-grid" onSubmit={submitPayment}>
          <label className="full-width">Labourer
            <select name="labourId" value={selectedLabour} onChange={(event) => setSelectedLabour(event.target.value)} required>
              <option value="" disabled>Select labourer</option>
              {salaries.map((labour) => <option value={labour._id} key={labour._id}>{labour.fullName} · Balance {money(labour.balance)}</option>)}
            </select>
          </label>
          <label>Salary month<input name="month" type="month" defaultValue={salaryMonth} required /></label>
          <label>Amount paid (₹)<input name="amount" type="number" min="1" step="1" placeholder="5000" required /></label>
          <label>Payment date<input name="paidDate" type="date" defaultValue={todayString} required /></label>
          <label>Payment method<select name="method" defaultValue="cash"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option></select></label>
          <label className="full-width">Note<input name="note" placeholder="Optional note" maxLength="250" /></label>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setModal("")}>Cancel</button><button className="button primary">Save payment</button></div>
        </form>
      </Modal>}
    </div>
  );
}

function AuthPage({ mode, checking, username, error, onModeChange, onSubmit }) {
  const isSignup = mode === "signup";
  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">AY</span>
          <div><strong>Amit Yadav</strong><small>LABOUR MANAGER</small></div>
        </div>
        <p className="eyebrow">{isSignup ? "NEW ACCOUNT" : "WELCOME BACK"}</p>
        <h1>{isSignup ? "Create your account" : "Login"}</h1>
        <p className="subheading">Log in or sign up to manage labour attendance and salary records.</p>
        {checking ? (
          <div className="login-checking">Loading…</div>
        ) : (
          <form className="login-form" onSubmit={onSubmit}>
            {isSignup && <label>Name / username<input name="username" autoComplete="username" minLength="3" maxLength="30" required /></label>}
            {!isSignup && <label>Name / username<input name="username" autoComplete="username" defaultValue={username} required /></label>}
            <label>Password<input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 8 : undefined} required /></label>
            {isSignup && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength="8" required /></label>}
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="button primary" type="submit">{isSignup ? "Sign up" : "Login"}</button>
          </form>
        )}
        {!checking && <button className="auth-switch" onClick={() => onModeChange(isSignup ? "login" : "signup")}>
          {isSignup ? "Already have an account? Login" : "New here? Create an account"}
        </button>}
        <p className="login-footnote">Labour attendance is maintained by the manager.</p>
      </section>
    </main>
  );
}

function Overview({ activeLabours, attendanceCounts, attendanceDate, markedAttendance, salaries, salaryTotals, setPage, setAttendanceDate, showNotice, username }) {
  const presentToday = attendanceCounts.present || 0;
  const attendanceRate = activeLabours.length ? Math.round((presentToday / activeLabours.length) * 100) : 0;
  return <>
    <div className="welcome-row">
      <div><p className="eyebrow">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p><h1>Good morning, {username} <span>✦</span></h1><p className="subheading">Here’s what’s happening with your workforce today.</p></div>
      <button className="button primary" onClick={() => setPage("attendance")}><span>＋</span> Mark attendance</button>
    </div>
    <div className="stats-grid">
      <StatCard label="Active labourers" value={activeLabours.length} detail="Currently on your team" icon="♙" color="green" />
      <StatCard label="Present today" value={`${presentToday} / ${activeLabours.length}`} detail={`${attendanceRate}% attendance rate`} icon="✓" color="blue" />
      <StatCard label="Salary paid this month" value={money(salaryTotals.paid)} detail={`${money(salaryTotals.balance)} remaining balance`} icon="₹" color="orange" />
      <StatCard label="Total wages earned" value={money(salaryTotals.earned)} detail="Based on marked attendance" icon="↗" color="violet" />
    </div>
    <div className="dashboard-grid">
      <section className="panel attendance-panel">
        <div className="panel-heading"><div><h2>Today’s attendance</h2><p>Daily workforce status</p></div><input className="date-control" aria-label="Attendance date" type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></div>
        {activeLabours.length === 0 ? <EmptyState text="Add labourers to start tracking attendance." action="Add a labourer" onClick={() => setPage("labours")} /> : <>
          <div className="attendance-summary"><div className="donut" style={{ "--progress": `${attendanceRate}%` }}><strong>{attendanceRate}%</strong><small>present</small></div><div className="summary-legend"><Legend color="green" label="Present" value={attendanceCounts.present || 0} /><Legend color="red" label="Absent" value={attendanceCounts.absent || 0} /><Legend color="amber" label="Half day / leave" value={(attendanceCounts["half-day"] || 0) + (attendanceCounts.leave || 0)} /></div></div>
          <div className="mini-list">{activeLabours.slice(0, 5).map((labour) => {
            const record = markedAttendance.get(String(labour._id));
            return <div className="mini-row" key={labour._id}><div className="person-cell"><div className="person-avatar">{labour.fullName.slice(0, 1).toUpperCase()}</div><div><strong>{labour.fullName}</strong><small>{labour.role}</small></div></div><span className={`status-pill ${record?.status || "unmarked"}`}>{record ? statusNames[record.status] : "Not marked"}</span></div>;
          })}</div>
          {activeLabours.length > 5 && <button className="text-button centered" onClick={() => setPage("attendance")}>View all attendance →</button>}
        </>}
      </section>
      <section className="panel salary-panel">
        <div className="panel-heading"><div><h2>Salary overview</h2><p>This month’s wages & payments</p></div><button className="more-button" onClick={() => setPage("salary")}>···</button></div>
        <div className="salary-highlight"><div><span>Total earned, including overtime</span><strong>{money(salaryTotals.earned)}</strong></div><div className="salary-highlight-icon">₹</div></div>
        <div className="salary-progress"><span style={{ width: `${salaryTotals.earned ? Math.min(100, (salaryTotals.paid / salaryTotals.earned) * 100) : 0}%` }} /></div>
        <div className="progress-caption"><span>{money(salaryTotals.paid)} paid</span><span>{money(salaryTotals.balance)} balance</span></div>
        <div className="section-divider" />
        <div className="panel-heading compact"><div><h3>Top balances</h3></div><button className="text-button" onClick={() => setPage("salary")}>See all</button></div>
        <div className="balance-list">{salaries.filter((item) => item.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 4).map((item) => <div className="balance-row" key={item._id}><div className="person-cell"><div className="person-avatar small">{item.fullName.slice(0, 1).toUpperCase()}</div><div><strong>{item.fullName}</strong><small>{item.role}</small></div></div><strong>{money(item.balance)}</strong></div>)}
          {!salaries.some((item) => item.balance > 0) && <p className="muted small-note">No outstanding salary balance.</p>}</div>
        <button className="button outline full-button" onClick={() => setPage("salary")}>Manage salaries <span>→</span></button>
      </section>
    </div>
    <div className="quick-actions"><div><h2>Quick actions</h2><p>Common tasks, right at your fingertips.</p></div><button onClick={() => setPage("labours")}><span className="quick-icon green-bg">＋</span><span><strong>Add labourer</strong><small>Register a new team member</small></span><b>→</b></button><button onClick={() => { setAttendanceDate(todayString); setPage("attendance"); }}><span className="quick-icon blue-bg">▦</span><span><strong>Mark attendance</strong><small>Update today’s work log</small></span><b>→</b></button><button onClick={() => setPage("salary")}><span className="quick-icon orange-bg">₹</span><span><strong>View payroll</strong><small>Track salaries and payments</small></span><b>→</b></button></div>
  </>;
}

function StatCard({ label, value, detail, icon, color }) {
  return <div className="stat-card"><div className={`stat-icon ${color}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></div>;
}

function Legend({ color, label, value }) {
  return <div className="legend-row"><span className={`legend-dot ${color}`} /><span>{label}</span><strong>{value}</strong></div>;
}

function LabourPage({ labours, onAdd, onToggleStatus, onDelete }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleLabours = labours.filter((labour) => {
    const matchesText = `${labour.fullName} ${labour.role} ${labour.phone}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (filter === "all" || labour.status === filter);
  });
  return <>
    <div className="page-title-row"><div><p className="eyebrow">YOUR TEAM</p><h1>Labour directory</h1><p className="subheading">Manage your workforce and their details.</p></div><button className="button primary" onClick={onAdd}><span>＋</span> Add labourer</button></div>
    <section className="panel table-panel">
      <div className="table-toolbar"><div><h2>All labourers <span className="count-badge">{labours.length}</span></h2><p>Contact details, roles and daily wages</p></div><div className="table-filters"><label className="search-box"><span>⌕</span><input aria-label="Search labourers" placeholder="Search labourers..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>
      <div className="table-scroll"><table><thead><tr><th>LABOURER</th><th>PHONE</th><th>ROLE</th><th>DAILY WAGE</th><th>JOINED</th><th>STATUS</th><th></th></tr></thead><tbody>
        {visibleLabours.map((labour) => <tr key={labour._id}><td><div className="person-cell"><div className="person-avatar">{labour.fullName.slice(0, 1).toUpperCase()}</div><div><strong>{labour.fullName}</strong><small>{labour.emergencyContact ? `Emergency: ${labour.emergencyContact}` : labour.address || "No additional details"}</small></div></div></td><td>{labour.phone}</td><td>{labour.role}</td><td>{money(labour.dailyWage)}<small className="table-subtext"> / day</small></td><td>{labour.joiningDate}</td><td><span className={`status-pill ${labour.status}`}>{labour.status}</span></td><td><div className="row-actions"><button className="text-button" onClick={() => onToggleStatus(labour)}>{labour.status === "active" ? "Deactivate" : "Activate"}</button><button className="text-button danger-text" onClick={() => onDelete(labour)}>Delete</button></div></td></tr>)}
        {visibleLabours.length === 0 && <tr><td colSpan="7"><EmptyState text={labours.length ? "No labourers match your search." : "Your labour directory is empty."} action={labours.length ? "" : "Add your first labourer"} onClick={onAdd} /></td></tr>}
      </tbody></table></div>
    </section>
  </>;
}

function AttendancePage({
  labours,
  markedAttendance,
  summary,
  date,
  setDate,
  month,
  setMonth,
  onSave,
  onGoToLabours,
  attendanceRevision,
}) {
  const savedRecordsKey = [...markedAttendance]
    .map(([labourId, record]) => `${labourId}-${record.status}-${record.overtimeHours}`)
    .join("|");
  return <>
    <div className="page-title-row"><div><p className="eyebrow">ADMIN-MANAGED WORK LOG</p><h1>Attendance</h1><p className="subheading">Admin records each labourer’s attendance and overtime. Labourers cannot mark it themselves.</p></div><label className="date-field">Attendance date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
    <form key={`${date}-${attendanceRevision}-${savedRecordsKey}`} onSubmit={onSave} className="panel table-panel">
      <div className="table-toolbar"><div><h2>Team attendance <span className="count-badge">{labours.length}</span></h2><p>Changes apply to {date}</p></div><button className="button primary" type="submit" disabled={!labours.length}>Save attendance</button></div>
      <div className="table-scroll"><table><thead><tr><th>LABOURER</th><th>ROLE</th><th>DAILY WAGE</th><th>STATUS</th><th>OVERTIME (HRS)</th></tr></thead><tbody>
        {labours.map((labour) => {
          const record = markedAttendance.get(String(labour._id));
          return <tr key={labour._id}><td><div className="person-cell"><div className="person-avatar">{labour.fullName.slice(0, 1).toUpperCase()}</div><div><strong>{labour.fullName}</strong><small>{labour.phone}</small></div></div></td><td>{labour.role}</td><td>{money(labour.dailyWage)}</td><td><select className={`attendance-select ${record?.status || ""}`} name={`status-${labour._id}`} defaultValue={record?.status || "present"}>{Object.entries(statusNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></td><td><input className="overtime-input" name={`overtime-${labour._id}`} type="number" min="0" step="0.5" defaultValue={record?.overtimeHours || 0} aria-label={`Overtime hours for ${labour.fullName}`} /></td></tr>;
        })}
        {!labours.length && <tr><td colSpan="5"><EmptyState text="Add active labourers before marking attendance." action="Go to labour directory" onClick={onGoToLabours} /></td></tr>}
      </tbody></table></div>
    </form>
    <section className="panel table-panel attendance-history">
      <div className="table-toolbar">
        <div><h2>Labour-wise attendance</h2><p>Monthly attendance summary and overtime recorded</p></div>
        <label className="date-field">Summary month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      </div>
      <div className="table-scroll"><table><thead><tr><th>LABOURER</th><th>PRESENT</th><th>HALF DAY</th><th>ATTENDANCE DAYS</th><th>ABSENT</th><th>LEAVE</th><th>OVERTIME HRS</th></tr></thead><tbody>
        {summary.map((labour) => (
          <tr key={labour._id}>
            <td><div className="person-cell"><div className="person-avatar">{labour.fullName.slice(0, 1).toUpperCase()}</div><div><strong>{labour.fullName}</strong><small>{labour.role}{labour.status === "inactive" ? " · Inactive" : ""}</small></div></div></td>
            <td>{labour.presentDays}</td>
            <td>{labour.halfDays}</td>
            <td><strong>{labour.attendanceDays}</strong><small className="table-subtext"> · {labour.recordedDays} days recorded</small></td>
            <td>{labour.absentDays}</td>
            <td>{labour.leaveDays}</td>
            <td>{labour.overtimeHours}</td>
          </tr>
        ))}
        {!summary.length && <tr><td colSpan="7"><EmptyState text="Add labourers to see the attendance summary." action="Go to labour directory" onClick={onGoToLabours} /></td></tr>}
      </tbody></table></div>
    </section>
    <p className="info-note">Attendance days are calculated as present days + half of half-days. Monthly totals include all labourers, including inactive workers with attendance history.</p>
  </>;
}

function SalaryPage({ salaries, totals, month, setMonth, onPay }) {
  return <>
    <div className="page-title-row"><div><p className="eyebrow">PAYROLL</p><h1>Salary & payments</h1><p className="subheading">Attendance-based wages, outstanding balances and payments.</p></div><label className="date-field">Salary month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div>
    <div className="salary-stats"><StatCard label="Total earned" value={money(totals.earned)} detail="Attendance + overtime pay" icon="↗" color="green" /><StatCard label="Total paid" value={money(totals.paid)} detail="Payments recorded" icon="✓" color="blue" /><StatCard label="Outstanding" value={money(totals.balance)} detail="Remaining to be paid" icon="₹" color="orange" /></div>
    <section className="panel table-panel"><div className="table-toolbar"><div><h2>Monthly payroll <span className="count-badge">{salaries.length}</span></h2><p>Wages and overtime calculated from recorded attendance</p></div></div><div className="table-scroll"><table><thead><tr><th>LABOURER</th><th>WORKED DAYS</th><th>DAILY WAGE</th><th>OVERTIME</th><th>EARNED</th><th>PAID</th><th>BALANCE</th><th></th></tr></thead><tbody>
      {salaries.map((labour) => <tr key={labour._id}><td><div className="person-cell"><div className="person-avatar">{labour.fullName.slice(0, 1).toUpperCase()}</div><div><strong>{labour.fullName}</strong><small>{labour.role}</small></div></div></td><td>{labour.presentDays + labour.halfDays * 0.5}<small className="table-subtext"> ({labour.halfDays} half day)</small></td><td>{money(labour.dailyWage)}</td><td><strong>{money(labour.overtimePay)}</strong><small className="table-subtext"> · {labour.overtimeHours} hrs</small></td><td><strong>{money(labour.earned)}</strong></td><td>{money(labour.paid)}</td><td><strong className={labour.balance > 0 ? "balance-amount" : "paid-amount"}>{money(labour.balance)}</strong></td><td>{labour.balance > 0 && <button className="text-button" onClick={() => onPay(labour._id)}>Record payment</button>}</td></tr>)}
      {!salaries.length && <tr><td colSpan="7"><EmptyState text="No labourers to show for this month." /></td></tr>}
    </tbody></table></div></section>
    <p className="info-note">Overtime is paid at daily wage ÷ 8 per recorded hour. Payment entries are recorded as received. If payments exceed earned wages, the balance will show as a negative amount.</p>
  </>;
}

function EmptyState({ text, action, onClick }) {
  return <div className="empty-state"><div className="empty-icon">▤</div><p>{text}</p>{action && <button className="text-button" type="button" onClick={onClick}>{action} →</button>}</div>;
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="close-button" onClick={onClose} aria-label="Close dialog">×</button></div>{children}</section></div>;
}

export default App;
