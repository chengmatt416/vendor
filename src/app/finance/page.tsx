'use client';
import { useState, useEffect } from 'react';
import { Fingerprint, LogOut, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export default function FinancePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [user, setUser] = useState<{name: string, role: string, username: string} | null>(null);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState('');

  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('records');
  const [data, setData] = useState<{records: any[], stats: any, products: any[]}>({ records: [], stats: {}, products: [] });
  const [employees, setEmployees] = useState<any[]>([]);
  const [newRec, setNewRec] = useState({ type: '支出', amount: '', note: '' });

  useEffect(() => {
    // Check if device supports WebAuthn
    if (window.PublicKeyCredential) {
       // Since passkey uses a username, we prompt for it in a real app,
       // but here we just show the button if supported.
       setHasPasskey(true);
    }

    // Check if we need to setup the first admin
    fetch('/api/financial/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkEmpty: true })
    })
    .then(r => r.json())
    .then(data => {
      if (data.needsSetup) setNeedsSetup(true);
    }).catch(console.error);
  }, []);

  const handleSetup = async () => {
    if (!setupName || !inputCode) return alert('請輸入姓名與代號');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/employees/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: setupName, code: inputCode })
      });
      const result = await res.json();
      if (result.success) {
        setNeedsSetup(false);
        handleLoginSuccess(result.name, result.role, result.username);
      } else {
        setLoginError(result.error || '設定失敗');
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const loginWithCode = async () => {
    if (!inputCode) return;
    setLoggingIn(true);
    try {
      const res = await fetch('/api/financial/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputCode })
      });
      const result = await res.json();
      if (result.success) {
        handleLoginSuccess(result.name, result.role, result.username);
      } else {
        setLoginError('代碼錯誤或無權限');
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const loginWithPasskey = async () => {
    const username = prompt("請輸入您的員工帳號 (username) 來使用 Passkey 登入財務系統");
    if (!username) return;
    try {
        const resp = await fetch('/api/webauthn/generate-authentication-options', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username })
        });
        const options = await resp.json();
        if (options.error) throw new Error(options.error);

        const asseResp = await startAuthentication({ optionsJSON: options });
        const verifyResp = await fetch('/api/webauthn/verify-authentication', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, response: asseResp })
        });
        const verification = await verifyResp.json();

        if (verification.verified) {
            // For simplicity, we fallback to code login if we can't fetch role from passkey alone without a proper session.
            // In a real app with sessions, we'd issue a JWT here.
            alert('Passkey 驗證成功！(示範：請輸入代碼載入權限)');
        } else {
            alert('驗證失敗');
        }
    } catch (e: any) {
         console.error(e);
         alert('Passkey 登入失敗: ' + e.message);
    }
  }

  const handleLoginSuccess = (name: string, role: string, username: string) => {
    setIsLoggedIn(true);
    setUser({ name, role, username });
    setLoginError('');
    fetchData();

    if (window.PublicKeyCredential && !localStorage.getItem(`passkey_${username}`)) {
       if (confirm('是否為此帳號建立 Passkey 以利快速登入？')) {
           registerPasskey(username);
       }
    }
  };

  const registerPasskey = async (username: string) => {
    try {
        const resp = await fetch('/api/webauthn/generate-registration-options', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username })
        });
        const options = await resp.json();
        const attResp = await startRegistration({ optionsJSON: options });
        const verifyResp = await fetch('/api/webauthn/verify-registration', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, response: attResp })
        });
        const verification = await verifyResp.json();
        if (verification.verified) localStorage.setItem(`passkey_${username}`, 'true');
    } catch (e: any) {
        console.error(e);
    }
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/financial');
      const d = await res.json();
      if (d && !d.error && Array.isArray(d.records) && Array.isArray(d.products)) {
        setData(d);
      } else {
        setData({ records: [], stats: {}, products: [] });
      }

      const empRes = await fetch('/api/employees');
      const empData = await empRes.json();
      if (Array.isArray(empData)) setEmployees(empData);
      else setEmployees([]);
    } catch (e) {
      setData({ records: [], stats: {}, products: [] });
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const addRecord = async () => {
    if (user?.role !== 'admin' && user?.role !== 'manager') return alert('權限不足');
    if (!newRec.amount || !newRec.note) return;
    try {
      const res = await fetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRec, role: user.role, recorder: user.name })
      });
      const result = await res.json();
      if (result.success) {
        setNewRec({ type: '支出', amount: '', note: '' });
        fetchData();
      }
    } catch (e) {}
  };

  const delRecord = async (id: string) => {
    if (user?.role !== 'admin' && user?.role !== 'manager') return;
    if (!confirm('確定刪除？')) return;
    try {
      await fetch(`/api/financial?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {}
  };

  const updateProduct = async (id: string, field: string, value: any) => {
    if (user?.role !== 'admin' && user?.role !== 'manager') return;
    try {
      await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
      fetchData();
    } catch (e) {}
  };

  const addProduct = async () => {
    if (user?.role !== 'admin' && user?.role !== 'manager') return;
    const name = prompt("請輸入商品名稱：");
    if (!name) return;
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price: 0, cost: 0, stock: 0 })
      });
      fetchData();
    } catch (e) {}
  };

  const delProduct = async (id: string) => {
    if (user?.role !== 'admin' && user?.role !== 'manager') return;
    if (!confirm('確定刪除此商品？')) return;
    try {
      await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {}
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const netProfit = (data.stats.income || 0) - (data.stats.expense || 0);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center">
          <div className="text-5xl mb-6">{needsSetup ? '🛠️' : '🔐'}</div>
          <h3 className="text-2xl font-bold mb-2">{needsSetup ? '初始化系統' : '財務系統'}</h3>
          <p className="text-gray-500 text-sm mb-6">{needsSetup ? '請建立第一位管理員' : '請驗證身份以繼續'}</p>

          {needsSetup ? (
            <>
              <input type="text" value={setupName} onChange={e => setSetupName(e.target.value)} className="w-full border-2 bg-gray-50 rounded-xl p-3 text-center mb-4 text-lg tracking-widest outline-none focus:border-gray-900" placeholder="您的姓名" />
              <input type="password" value={inputCode} onChange={e => setInputCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSetup()} className="w-full border-2 bg-gray-50 rounded-xl p-3 text-center mb-4 text-lg tracking-widest outline-none focus:border-gray-900" placeholder="設定登入代碼" />
              <button onClick={handleSetup} disabled={loggingIn} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                {loggingIn ? '處理中...' : '建立管理員並登入'}
              </button>
            </>
          ) : (
            <>
              {hasPasskey && (
                <>
                  <button onClick={loginWithPasskey} className="w-full bg-indigo-50 text-indigo-600 border border-indigo-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition">
                    <Fingerprint className="w-5 h-5" /> 生物辨識登入
                  </button>
                  <div className="text-gray-400 text-sm my-4">- 或 -</div>
                </>
              )}

              <input type="password" value={inputCode} onChange={e => setInputCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && loginWithCode()} className="w-full border-2 bg-gray-50 rounded-xl p-3 text-center mb-4 text-lg tracking-widest outline-none focus:border-gray-900" placeholder="輸入代碼" />
              <button onClick={loginWithCode} disabled={loggingIn} className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50">
                {loggingIn ? '驗證中...' : '密碼登入'}
              </button>
            </>
          )}

          {loginError && <div className="text-red-500 text-sm mt-3 font-bold">{loginError}</div>}
          <div className="mt-8 pt-4 border-t"><a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 返回首頁</a></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-1 flex items-center gap-2">📊 財務看板</h2>
          <span className={`px-2 py-1 text-xs font-bold rounded-md ${isAdmin ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {isAdmin ? '管理員' : '檢視者'}: {user?.name}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2 bg-white border rounded-lg hover:bg-gray-50 shadow-sm"><RefreshCw className="w-5 h-5 text-gray-600" /></button>
          <button onClick={() => setIsLoggedIn(false)} className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-gray-600 shadow-sm flex items-center gap-2"><LogOut className="w-4 h-4"/> 登出</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">載入中...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
              <div className="text-gray-500 text-sm">總收入</div>
              <div className="text-2xl font-bold text-green-600">${(data.stats.income || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
              <div className="text-gray-500 text-sm">總支出</div>
              <div className="text-2xl font-bold text-red-600">${(data.stats.expense || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
              <div className="text-gray-500 text-sm">現金淨利</div>
              <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netProfit >= 0 ? '+' : ''}${(netProfit).toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-100 p-4 rounded-xl">
              <div className="text-gray-500 text-sm">庫存價值</div>
              <div className="text-2xl font-bold text-gray-800">${(data.stats.inventoryValue || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <button onClick={() => setTab('records')} className={`px-4 py-2 rounded-lg font-medium transition ${tab === 'records' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>📝 收支紀錄</button>
            <button onClick={() => setTab('products')} className={`px-4 py-2 rounded-lg font-medium transition ${tab === 'products' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>📦 庫存成本</button>
            <button onClick={() => setTab('employees')} className={`px-4 py-2 rounded-lg font-medium transition ${tab === 'employees' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>👥 員工資料</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {tab === 'records' && (
              <div className="p-4 md:p-6">
                {isAdmin ? (
                  <div className="bg-gray-50 p-4 rounded-xl mb-6 flex flex-wrap gap-3 items-center">
                    <select value={newRec.type} onChange={e => setNewRec({...newRec, type: e.target.value})} className="border rounded-lg px-3 py-2 bg-white">
                      <option>收入</option><option>支出</option>
                    </select>
                    <input type="number" placeholder="金額" value={newRec.amount} onChange={e => setNewRec({...newRec, amount: e.target.value})} className="border rounded-lg px-3 py-2 w-32" />
                    <input type="text" placeholder="備註 (如: 進貨可樂)" value={newRec.note} onChange={e => setNewRec({...newRec, note: e.target.value})} className="border rounded-lg px-3 py-2 flex-1 min-w-[200px]" />
                    <button onClick={addRecord} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-1 hover:bg-blue-700"><Plus className="w-4 h-4"/> 新增</button>
                  </div>
                ) : (
                  <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-6">🔒 檢視者模式：您僅有查看權限，無法新增紀錄。</div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b text-gray-500 text-sm">
                        <th className="p-3 font-medium">日期</th>
                        <th className="p-3 font-medium">類型</th>
                        <th className="p-3 font-medium">金額</th>
                        <th className="p-3 font-medium">備註</th>
                        {isAdmin && <th className="p-3 font-medium"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.records.map(r => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="p-3 text-sm text-gray-500">{r.date}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 text-xs font-bold rounded-md ${r.type === '收入' ? 'bg-green-100 text-green-700' : r.type === '支出' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{r.type}</span>
                          </td>
                          <td className="p-3 font-bold">${r.amount.toLocaleString()}</td>
                          <td className="p-3 text-sm">{r.note}</td>
                          {isAdmin && (
                            <td className="p-3 text-right">
                              <button onClick={() => delRecord(r.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'employees' && (
              <div className="p-4 md:p-6">
                 {isAdmin ? (
                  <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex-1">💡 修改欄位後失去焦點(Blur)即自動儲存。</div>
                    <button onClick={() => {
                        const name = prompt("請輸入員工姓名：");
                        const code = prompt("請輸入員工代號 (Code)：");
                        if (!name || !code) return;
                        fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, code }) }).then(fetchData);
                    }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-1 hover:bg-blue-700 whitespace-nowrap"><Plus className="w-4 h-4"/> 新增員工</button>
                  </div>
                ) : (
                  <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-6">🔒 檢視者模式：您無法修改資料。</div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b text-gray-500 text-sm">
                        <th className="p-3 font-medium">員工姓名</th>
                        <th className="p-3 font-medium">員工代號 (Code)</th>
                        <th className="p-3 font-medium">帳號 (Username)</th>
                        <th className="p-3 font-medium">權限角色</th>
                        <th className="p-3 font-medium">信用額度</th>
                        <th className="p-3 font-medium">已用額度</th>
                        <th className="p-3 font-medium">餘額</th>
                        {isAdmin && <th className="p-3 font-medium"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp => (
                        <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="p-3">
                            <input
                              type="text"
                              defaultValue={emp.name}
                              disabled={!isAdmin}
                              onBlur={(e) => {
                                  if(e.target.value !== emp.name) {
                                     fetch('/api/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: emp.id, name: e.target.value }) }).then(fetchData);
                                  }
                              }}
                              className="border rounded p-1 w-full outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="password"
                              placeholder="****"
                              disabled={!isAdmin}
                              onBlur={(e) => {
                                  if(e.target.value && e.target.value.trim() !== '') {
                                     fetch('/api/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: emp.id, code: e.target.value }) }).then(fetchData);
                                     e.target.value = '';
                                  }
                              }}
                              className="border rounded p-1 w-24 outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent"
                            />
                          </td>
                          <td className="p-3 text-sm text-gray-500">{emp.username}</td>
                          <td className="p-3">
                            <select
                              defaultValue={emp.role}
                              disabled={!isAdmin}
                              onChange={(e) => {
                                 fetch('/api/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: emp.id, role: e.target.value }) }).then(fetchData);
                              }}
                              className="border rounded p-1 outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:appearance-none"
                            >
                               <option value="admin">Admin</option>
                               <option value="manager">Manager</option>
                               <option value="viewer">Viewer</option>
                            </select>
                          </td>
                          <td className="p-3">
                             <div className="flex items-center">
                              <span className="text-gray-400 mr-1">$</span>
                              <input
                                type="number"
                                defaultValue={emp.creditLimit}
                                disabled={!isAdmin}
                                onBlur={(e) => {
                                    if(Number(e.target.value) !== emp.creditLimit) {
                                        fetch('/api/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: emp.id, creditLimit: Number(e.target.value) }) }).then(fetchData);
                                    }
                                }}
                                className="border rounded p-1 w-20 outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                             <div className="flex items-center">
                              <span className="text-gray-400 mr-1">$</span>
                              <input
                                type="number"
                                defaultValue={emp.usedCredit}
                                disabled={!isAdmin}
                                onBlur={(e) => {
                                    if(Number(e.target.value) !== emp.usedCredit) {
                                        fetch('/api/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: emp.id, usedCredit: Number(e.target.value) }) }).then(fetchData);
                                    }
                                }}
                                className="border rounded p-1 w-20 outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent"
                              />
                            </div>
                          </td>
                          <td className="p-3 font-bold text-gray-700">${Number(emp.creditLimit || 0) - Number(emp.usedCredit || 0)}</td>
                          {isAdmin && (
                            <td className="p-3 text-right">
                              <button onClick={() => {
                                  if (confirm('確定刪除此員工？')) {
                                      fetch(`/api/employees?id=${emp.id}`, { method: 'DELETE' }).then(fetchData);
                                  }
                              }} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'products' && (
              <div className="p-4 md:p-6">
                 {isAdmin ? (
                  <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex-1">💡 修改欄位後失去焦點(Blur)即自動儲存。</div>
                    <button onClick={addProduct} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-1 hover:bg-blue-700 whitespace-nowrap"><Plus className="w-4 h-4"/> 新增商品</button>
                  </div>
                ) : (
                  <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-6">🔒 檢視者模式：您無法修改資料。</div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b text-gray-500 text-sm">
                        <th className="p-3 font-medium">商品名稱</th>
                        <th className="p-3 font-medium">售價</th>
                        <th className="p-3 font-medium">成本</th>
                        <th className="p-3 font-medium">庫存</th>
                        <th className="p-3 font-medium">庫存總值</th>
                        {isAdmin && <th className="p-3 font-medium"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.products.map(p => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="p-3">
                            <input
                              type="text"
                              defaultValue={p.name}
                              disabled={!isAdmin}
                              onBlur={(e) => updateProduct(p.id, 'name', e.target.value)}
                              className="border rounded p-1 w-full outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-1">$</span>
                              <input
                                type="number"
                                defaultValue={p.price}
                                disabled={!isAdmin}
                                onBlur={(e) => updateProduct(p.id, 'price', Number(e.target.value))}
                                className="border rounded p-1 w-20 outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-1">$</span>
                              <input
                                type="number"
                                defaultValue={p.cost}
                                disabled={!isAdmin}
                                onBlur={(e) => updateProduct(p.id, 'cost', Number(e.target.value))}
                                className="border rounded p-1 w-20 outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent"
                              />
                            </div>
                          </td>
                          <td className={`p-3 ${p.stock < 5 ? 'text-red-500 font-bold' : ''}`}>
                             <input
                                type="number"
                                defaultValue={p.stock}
                                disabled={!isAdmin}
                                onBlur={(e) => updateProduct(p.id, 'stock', Number(e.target.value))}
                                className={`border rounded p-1 w-20 outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent ${p.stock < 5 ? 'text-red-500' : ''}`}
                              />
                          </td>
                          <td className="p-3 text-gray-500">${(p.stock * p.cost).toLocaleString()}</td>
                          {isAdmin && (
                            <td className="p-3 text-right">
                              <button onClick={() => delProduct(p.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
