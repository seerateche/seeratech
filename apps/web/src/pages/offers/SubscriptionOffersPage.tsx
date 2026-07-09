import React, { useState } from 'react';
import { Tag, Plus, Search, MoreVertical, Wifi, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../utils/api';
import { AddOfferModal } from './AddOfferModal';

export const SubscriptionOffersPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['billing', 'packages'],
    queryFn: () => apiGet('/billing/packages'),
  });

  const filteredOffers = offers.filter((offer: any) => 
    offer.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 lg:p-8 ml-64 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">عروض الاشتراك</h1>
          <p className="text-slate-400">إدارة الباقات وعروض الإنترنت للعملاء</p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          إضافة عرض جديد
        </button>
      </div>
      
      <div className="card flex flex-col h-full min-h-[400px]">
        <div className="p-4 border-b border-surface-2 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث باسم العرض أو الباقة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-4 pr-10 w-full"
            />
          </div>
        </div>

        <div className="flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-400">جاري التحميل...</div>
          ) : filteredOffers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Tag className="w-16 h-16 mb-4 opacity-20" />
              <p>لا توجد عروض مسجلة حتى الآن</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOffers.map((offer: any) => (
                <div key={offer.id} className="bg-surface-2/30 rounded-xl p-6 border border-surface-2 hover:border-sira-500/30 transition-colors group">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-slate-200">{offer.name}</h3>
                    <button className="btn-ghost btn-icon w-8 h-8 opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                  
                  <div className="flex items-end gap-2 mb-6">
                    <span className="text-3xl font-bold text-sira-400">{offer.price}</span>
                    <span className="text-slate-500 mb-1">ج.م / {offer.durationDays} يوم</span>
                  </div>

                  <div className="space-y-3">
                    {offer.speed && (
                      <div className="flex items-center text-slate-300">
                        <Activity className="w-4 h-4 mr-3 text-emerald-400" />
                        السرعة: {offer.speed}
                      </div>
                    )}
                    {offer.quota && (
                      <div className="flex items-center text-slate-300">
                        <Wifi className="w-4 h-4 mr-3 text-blue-400" />
                        السعة: {offer.quota}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isAddModalOpen && <AddOfferModal onClose={() => setIsAddModalOpen(false)} />}
    </div>
  );
};
