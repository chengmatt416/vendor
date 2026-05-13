'use client';
import { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<{isLoggedIn: boolean, name?: string, balance?: number, code?: string, username?: string}>({ isLoggedIn: false });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [order, setOrder] = useState({ qty: 1, userName: '', userEmail: '', userDept: '' });
  const [submitting, setSubmitting] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          console.error('Failed to fetch products:', data);
          setProducts([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setProducts([]);
        setLoading(false);
      });
  }, []);

  const totalPrice = selectedProduct ?
    (selectedProduct.promoQty && order.qty >= selectedProduct.promoQty ? selectedProduct.promoPrice : selectedProduct.price) * order.qty
    : 0;

  const doLogin = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/employees/login', {
        method: 'POST',
        body: JSON.stringify({ code: loginCode }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setEmployee({ isLoggedIn: true, ...data });
        setShowLoginModal(false);
        // Prompt passkey registration if supported
        if (window.PublicKeyCredential && !localStorage.getItem(`passkey_${data.username}`)) {
            if (confirm('是否為此帳號建立 Passkey 以利快速登入？')) {
               registerPasskey(data.username);
            }
        }
      } else {
        alert(data.error);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const registerPasskey = async (username: string) => {
      try {
          const resp = await fetch('/api/webauthn/generate-registration-options', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username })
          });
          const options = await resp.json();
          if (options.error) throw new Error(options.error);

          const attResp = await startRegistration({ optionsJSON: options });
          const verifyResp = await fetch('/api/webauthn/verify-registration', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, response: attResp })
          });
          const verification = await verifyResp.json();
          if (verification.verified) {
              alert('Passkey 建立成功！');
              localStorage.setItem(`passkey_${username}`, 'true');
          }
      } catch (e: any) {
          console.error(e);
          alert('Passkey 建立失敗: ' + e.message);
      }
  }

  const loginWithPasskey = async () => {
      const username = prompt("請輸入您的員工帳號 (username) 來使用 Passkey 登入");
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
              // Since WebAuthn only verified identity, we need to fetch user data
              // In a real app we'd issue a JWT. Here we just fetch info based on code/username.
              alert('Passkey 登入成功！請重新整理並使用代碼登入以載入餘額。(此為示範，實務應直接回傳 Session)');
          } else {
              alert('驗證失敗');
          }
      } catch (e: any) {
           console.error(e);
           alert('Passkey 登入失敗: ' + e.message);
      }
  }

  const submitOrder = async () => {
    if (order.qty > selectedProduct.stock) return alert('庫存不足');
    if (!employee.isLoggedIn && !order.userName) return alert('請輸入姓名');
    if (sigPad.current?.isEmpty()) return alert('請簽名');

    setSubmitting(true);
    const payload = {
      productName: selectedProduct.name,
      qty: order.qty,
      total: totalPrice,
      userName: order.userName,
      userEmail: order.userEmail,
      userDept: order.userDept,
      employeeCode: employee.code,
      signature: sigPad.current?.getTrimmedCanvas().toDataURL('image/png')
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('購買成功！\n' + data.message);
        setSelectedProduct(null);
        window.location.reload();
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">🛒 公司福利社</h2>
        <div>
          {employee.isLoggedIn ? (
            <div className="flex items-center gap-4">
              <span className="text-green-600 font-bold">{employee.name}</span>
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">餘額 ${employee.balance}</span>
              <button onClick={() => setEmployee({isLoggedIn: false})} className="text-sm text-gray-500 hover:text-gray-700">登出</button>
            </div>
          ) : (
            <div className="flex gap-2">
                <button onClick={loginWithPasskey} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-200">Passkey 登入</button>
                <button onClick={() => setShowLoginModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">員工登入</button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">載入中...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map(p => (
            <div key={p.id} onClick={() => { setSelectedProduct(p); setOrder({...order, qty: 1}) }} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden border border-gray-100">
              <div className="h-40 bg-gray-100 flex items-center justify-center text-gray-400 relative">
                {p.image ? <img src={p.image} className="w-full h-full object-cover" alt={p.name} /> : <span>無圖片</span>}
              </div>
              <div className="p-4">
                <h5 className="font-semibold text-lg mb-1">{p.name}</h5>
                <p className="text-red-500 font-bold mb-1">${p.price}</p>
                <p className="text-sm text-gray-500">庫存: {p.stock}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h5 className="text-xl font-bold">員工登入</h5>
              <button onClick={() => setShowLoginModal(false)} className="text-gray-500 hover:text-gray-700">&times;</button>
            </div>
            <input type="password" value={loginCode} onChange={e => setLoginCode(e.target.value)} className="w-full border rounded-lg p-2 mb-4" placeholder="請輸入員工代號" />
            <button onClick={doLogin} disabled={authLoading} className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50">
              {authLoading ? '登入中...' : '登入'}
            </button>
          </div>
        </div>
      )}

      {/* Buy Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md my-8">
            <div className="flex justify-between items-center mb-4">
              <h5 className="text-xl font-bold">購買: {selectedProduct.name}</h5>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">數量</label>
              <input type="number" min="1" max={selectedProduct.stock} value={order.qty} onChange={e => setOrder({...order, qty: Number(e.target.value)})} className="w-full border rounded-lg p-2" />
            </div>
            <div className="text-right text-xl text-red-600 font-bold mb-4">總計: ${totalPrice}</div>

            {!employee.isLoggedIn && (
              <div className="space-y-3 mb-4 border-t pt-4">
                <input type="text" value={order.userName} onChange={e => setOrder({...order, userName: e.target.value})} className="w-full border rounded-lg p-2" placeholder="姓名 (必填)" />
                <input type="email" value={order.userEmail} onChange={e => setOrder({...order, userEmail: e.target.value})} className="w-full border rounded-lg p-2" placeholder="Email (必填)" />
                <input type="text" value={order.userDept} onChange={e => setOrder({...order, userDept: e.target.value})} className="w-full border rounded-lg p-2" placeholder="部門" />
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">請簽名確認：</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 relative h-40 w-full overflow-hidden">
                <SignatureCanvas ref={sigPad} canvasProps={{ className: 'w-full h-full' }} />
              </div>
              <div className="text-right mt-1">
                <button onClick={() => sigPad.current?.clear()} className="text-sm text-gray-500 hover:text-gray-700">清除重簽</button>
              </div>
            </div>

            <button onClick={submitOrder} disabled={submitting} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg disabled:opacity-50">
              {submitting ? '處理中...' : '確認購買'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
