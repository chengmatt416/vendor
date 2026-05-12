'use client';
import { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { ShoppingCart, User, Plus, Minus, Trash2 } from 'lucide-react';

export default function POSSystem() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeCode, setEmployeeCode] = useState('');
  const [employee, setEmployee] = useState<{name?: string, balance?: number, code?: string} | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);

  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', dept: '' });
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setProducts(data);
        else setProducts([]);
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setLoading(false);
      });
  }, []);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev; // check stock
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        if (newQty <= 0) return item; // handle remove separately
        if (newQty > item.stock) return item;
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    if(confirm('確定要清空購物車？')) setCart([]);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const priceToUse = (item.promoQty && item.qty >= item.promoQty) ? item.promoPrice : item.price;
      return sum + (priceToUse * item.qty);
    }, 0);
  };

  const verifyEmployee = async () => {
    if(!employeeCode) return;
    try {
      const res = await fetch('/api/employees/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: employeeCode })
      });
      const data = await res.json();
      if(data.success) {
        setEmployee(data);
      } else {
        alert(data.error);
        setEmployee(null);
      }
    } catch(e) {}
  };

  const submitOrder = async () => {
      if (cart.length === 0) return;
      if (!employee && !customerInfo.name) return alert('請輸入姓名或刷員工證');
      if (sigPad.current?.isEmpty()) return alert('請簽名');

      setSubmitting(true);

      // Since API currently supports one product per order, we loop or modify API.
      // Modifying API to accept array of items is better, but to save time and ensure it works with existing backend:
      // We will loop through cart and submit individually. For a real POS we'd rewrite the backend to handle carts.
      // Let's assume we do it sequentially here for compatibility with existing app logic.

      let allSuccess = true;
      const signatureStr = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');

      for (const item of cart) {
          const itemTotal = (item.promoQty && item.qty >= item.promoQty) ? item.promoPrice : item.price;
          const payload = {
            productName: item.name,
            qty: item.qty,
            total: itemTotal * item.qty,
            userName: employee ? employee.name : customerInfo.name,
            userEmail: employee ? '' : customerInfo.email,
            userDept: employee ? '' : customerInfo.dept,
            employeeCode: employee?.code,
            signature: signatureStr
          };

          try {
            const res = await fetch('/api/orders', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if(!data.success) {
                alert(`商品 ${item.name} 結帳失敗: ${data.error}`);
                allSuccess = false;
            }
          } catch(e) {
              allSuccess = false;
          }
      }

      setSubmitting(false);

      if (allSuccess) {
          alert('結帳成功！');
          setCart([]);
          setEmployee(null);
          setEmployeeCode('');
          setCustomerInfo({name:'', email:'', dept:''});
          setShowCheckout(false);
          sigPad.current?.clear();
          // Reload products stock
          fetch('/api/products').then(r=>r.json()).then(d => {
            if (Array.isArray(d)) setProducts(d);
            else setProducts([]);
          }).catch(() => setProducts([]));
      }
  };

  const total = calculateTotal();

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans select-none">
      {/* Main Product Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="bg-white shadow-sm p-4 flex justify-between items-center z-10">
          <h1 className="text-2xl font-bold text-gray-800">POS 結帳系統</h1>
          <div className="text-gray-500 text-sm">{new Date().toLocaleDateString('zh-TW')}</div>
        </header>

        {/* Products */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
           {loading ? (
             <div className="flex items-center justify-center h-full text-gray-400">載入商品中...</div>
           ) : (
             <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
               {products.map(p => (
                 <button
                   key={p.id}
                   onClick={() => addToCart(p)}
                   disabled={p.stock <= 0}
                   className={`relative flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden active:scale-95 transition-transform ${p.stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                 >
                   <div className="h-32 w-full bg-gray-50 flex items-center justify-center">
                      {p.image ? <img src={p.image} className="w-full h-full object-cover pointer-events-none" /> : <span className="text-gray-300">無圖</span>}
                   </div>
                   <div className="p-3 text-left w-full border-t">
                      <div className="font-bold text-gray-800 truncate leading-tight">{p.name}</div>
                      <div className="flex justify-between items-end mt-1">
                        <span className="text-red-500 font-black text-lg">${p.price}</span>
                        <span className="text-xs text-gray-400 font-medium">存: {p.stock}</span>
                      </div>
                   </div>
                   {p.stock <= 0 && <div className="absolute inset-0 bg-white/60 flex items-center justify-center font-bold text-red-600 rotate-[-15deg] text-xl">售完</div>}
                 </button>
               ))}
             </div>
           )}
        </main>
      </div>

      {/* Cart Sidebar */}
      <aside className="w-96 bg-white border-l shadow-2xl flex flex-col h-full z-20">
        <div className="p-4 bg-gray-50 border-b flex items-center gap-2">
           <ShoppingCart className="text-gray-600" />
           <h2 className="text-lg font-bold text-gray-800">購物車</h2>
           <span className="ml-auto bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-sm font-bold">{cart.length}</span>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-2">
           {cart.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
               <ShoppingCart size={48} className="opacity-20" />
               <p>尚未選擇商品</p>
             </div>
           ) : (
             <div className="space-y-2">
               {cart.map(item => (
                 <div key={item.id} className="flex flex-col p-3 border rounded-xl bg-white hover:border-blue-200 transition">
                   <div className="flex justify-between mb-2">
                      <span className="font-bold text-gray-800">{item.name}</span>
                      <button onClick={()=>removeFromCart(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={18}/></button>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-red-500 font-bold">${(item.promoQty && item.qty >= item.promoQty) ? item.promoPrice : item.price}</span>
                      <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button onClick={()=>updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 active:scale-95"><Minus size={16}/></button>
                        <span className="w-10 text-center font-bold">{item.qty}</span>
                        <button onClick={()=>updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 active:scale-95"><Plus size={16}/></button>
                      </div>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>

        {/* Total & Checkout Btn */}
        <div className="p-4 bg-white border-t space-y-4">
           <div className="flex justify-between items-end">
              <span className="text-gray-500 font-medium">總計金額</span>
              <span className="text-4xl font-black text-red-600">${total}</span>
           </div>
           <div className="flex gap-2">
              <button onClick={clearCart} disabled={cart.length===0} className="px-4 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl active:bg-gray-200 disabled:opacity-50">清空</button>
              <button onClick={()=>setShowCheckout(true)} disabled={cart.length===0} className="flex-1 bg-blue-600 text-white font-bold text-xl rounded-xl py-4 active:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 transition">結帳</button>
           </div>
        </div>
      </aside>

      {/* Checkout Modal (Full screen overlay for iPad) */}
      {showCheckout && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex overflow-hidden h-[80vh] min-h-[600px]">

            {/* Left side: Verification / Info */}
            <div className="w-1/2 p-8 border-r bg-gray-50 flex flex-col">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-2xl font-bold text-gray-800">身分驗證</h3>
                 <button onClick={()=>setShowCheckout(false)} className="text-gray-400 text-3xl hover:text-gray-600">&times;</button>
               </div>

               <div className="bg-white p-4 rounded-2xl shadow-sm border mb-6">
                 <label className="text-sm font-bold text-gray-500 mb-2 block">員工刷卡 (輸入代號)</label>
                 <div className="flex gap-2">
                   <input
                      type="password"
                      value={employeeCode}
                      onChange={e=>setEmployeeCode(e.target.value)}
                      onKeyDown={e=>e.key==='Enter' && verifyEmployee()}
                      className="flex-1 bg-gray-100 border-transparent rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="掃描或輸入..."
                      autoFocus
                   />
                   <button onClick={verifyEmployee} className="bg-gray-800 text-white px-6 rounded-xl font-bold">確認</button>
                 </div>
                 {employee && (
                   <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                     <div className="bg-green-100 p-2 rounded-full"><User className="text-green-600"/></div>
                     <div>
                       <div className="font-bold text-green-800">{employee.name}</div>
                       <div className="text-sm text-green-600 font-medium">餘額: ${employee.balance}</div>
                     </div>
                   </div>
                 )}
               </div>

               <div className="text-center text-gray-400 font-bold mb-6">- 或訪客購買 -</div>

               <div className="space-y-4 flex-1">
                  <div>
                    <label className="text-sm font-bold text-gray-500 mb-1 block">訪客姓名</label>
                    <input type="text" disabled={!!employee} value={customerInfo.name} onChange={e=>setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full bg-white border rounded-xl px-4 py-3 text-lg outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100" />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-500 mb-1 block">Email (收據用)</label>
                    <input type="email" disabled={!!employee} value={customerInfo.email} onChange={e=>setCustomerInfo({...customerInfo, email: e.target.value})} className="w-full bg-white border rounded-xl px-4 py-3 text-lg outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100" />
                  </div>
               </div>
            </div>

            {/* Right side: Signature & Submit */}
            <div className="w-1/2 p-8 flex flex-col bg-white">
               <h3 className="text-2xl font-bold text-gray-800 mb-2">確認與簽名</h3>
               <p className="text-gray-500 mb-6">總金額：<span className="text-3xl text-red-600 font-black ml-2">${total}</span></p>

               <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-gray-700 font-bold">請在此簽名：</label>
                    <button onClick={()=>sigPad.current?.clear()} className="text-blue-600 font-bold text-sm bg-blue-50 px-3 py-1 rounded-full">清除重簽</button>
                  </div>
                  <div className="flex-1 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 relative overflow-hidden mb-6">
                    <SignatureCanvas
                      ref={sigPad}
                      canvasProps={{ className: 'w-full h-full' }}
                      minWidth={2}
                      maxWidth={4}
                    />
                  </div>

                  <button
                    onClick={submitOrder}
                    disabled={submitting || (!employee && !customerInfo.name)}
                    className="w-full bg-green-600 text-white font-bold text-2xl py-6 rounded-2xl shadow-xl shadow-green-200 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
                  >
                    {submitting ? '處理中...' : '確認結帳'}
                  </button>
               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
