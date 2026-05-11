'use client';
import { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Search, CheckCircle2 } from 'lucide-react';

export default function SignoffPage() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const [signerName, setSignerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);

  const search = async () => {
    if (!keyword) return;
    setLoading(true);
    setSearched(false);
    setSelectedOrderIds(new Set());
    try {
      const res = await fetch(`/api/signoff/search?keyword=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      setOrders(data);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrder = (id: string) => {
    const newSet = new Set(selectedOrderIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedOrderIds(newSet);
  };

  const submit = async () => {
    if (!signerName) return alert('請輸入姓名');
    if (sigPad.current?.isEmpty()) return alert('請簽名');
    if (selectedOrderIds.size === 0) return alert('請選擇訂單');

    setSubmitting(true);
    const selectedOrdersData = orders.filter(o => selectedOrderIds.has(o.orderId));

    const payload = {
      orders: selectedOrdersData,
      signerName,
      signature: sigPad.current?.getTrimmedCanvas().toDataURL('image/png')
    };

    try {
      const res = await fetch('/api/signoff/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ 簽收成功！\n' + data.message);
        if (data.downloadUrl) window.open(data.downloadUrl, '_blank');
        search(); // reload
        setSignerName('');
        sigPad.current?.clear();
      } else {
        alert('❌ 失敗: ' + data.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Fix Signature canvas resize issue
  useEffect(() => {
    const handleResize = () => {
      if (sigPad.current) {
        const canvas = sigPad.current.getCanvas();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        // Note: react-signature-canvas handles some of this, but it's good practice for crisp lines on high-dpi screens
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedOrderIds.size]);

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 touch-pan-y">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gray-900 text-white p-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">✍️ 訂單簽收系統</h2>
          <p className="text-gray-400 text-sm mt-1">搜尋姓名或 Email 以進行批量簽收</p>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-lg"
                placeholder="輸入姓名或 Email..."
              />
            </div>
            <button onClick={search} disabled={loading} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50">
              {loading ? '搜尋中...' : '搜尋'}
            </button>
          </div>

          {orders.length > 0 ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-gray-500 font-medium mb-3">請勾選要簽收的項目：</p>
              <div className="space-y-3 mb-8">
                {orders.map(order => (
                  <label key={order.orderId} className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition ${selectedOrderIds.has(order.orderId) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="relative flex items-center justify-center mt-1">
                       <input
                         type="checkbox"
                         checked={selectedOrderIds.has(order.orderId)}
                         onChange={() => toggleOrder(order.orderId)}
                         className="peer sr-only"
                       />
                       <div className="w-6 h-6 border-2 border-gray-300 rounded peer-checked:bg-blue-500 peer-checked:border-blue-500 flex items-center justify-center transition">
                         <CheckCircle2 className={`w-4 h-4 text-white ${selectedOrderIds.has(order.orderId) ? 'opacity-100' : 'opacity-0'} transition`} />
                       </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex justify-between items-start">
                        <strong className="text-lg text-gray-900">{order.product} <span className="text-gray-500 font-normal">x{order.qty}</span></strong>
                        <span className="text-red-500 font-bold">${order.total}</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1 flex justify-between">
                        <span>{order.date}</span>
                        <span>{order.email ? `✉️ ${order.email}` : '⚠️ 無Email'}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {selectedOrderIds.size > 0 && (
                <div className="border-t-2 border-dashed border-gray-200 pt-8 animate-in fade-in duration-300">
                  <div className="mb-6">
                    <label className="block text-gray-700 font-bold mb-2">簽收人姓名</label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={e => setSignerName(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-blue-500"
                      placeholder="請輸入姓名"
                    />
                  </div>

                  <div className="mb-8">
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-gray-700 font-bold">請簽名</label>
                      <button onClick={() => sigPad.current?.clear()} className="text-sm text-blue-600 hover:text-blue-800">清除重寫</button>
                    </div>
                    <div className="border-2 border-gray-300 rounded-xl bg-gray-50 h-48 relative overflow-hidden">
                      <SignatureCanvas
                        ref={sigPad}
                        canvasProps={{ className: 'w-full h-full' }}
                        backgroundColor="rgb(249, 250, 251)"
                      />
                    </div>
                  </div>

                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-green-700 transition disabled:opacity-50 shadow-lg shadow-green-200"
                  >
                    {submitting ? '處理中...' : `確認簽收 (${selectedOrderIds.size} 筆)`}
                  </button>
                </div>
              )}
            </div>
          ) : searched ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-4xl mb-4">📭</div>
              查無待簽收的訂單資料
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
