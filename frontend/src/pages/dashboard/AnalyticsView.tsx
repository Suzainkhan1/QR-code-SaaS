import React from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';

interface AnalyticsViewProps {
  analytics: {
    summary: {
      todayOrders: number;
      todayRevenue: number;
      pendingOrders: number;
      averageOrderValue: number;
      grossProfit: number;
      netProfit: number;
      profitMargin: number;
      totalRevenue: number;
      totalExpenses: number;
      averagePrepTime?: number;
      averageTurnoverTime?: number;
    };
    dailyRevenueGraph: any[];
    categorySales: any[];
  };
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics }) => {
  return (
    <div>
      <h2 className="text-xl font-bold text-brand-textPrimary mb-6">Financial performance & SaaS analytics</h2>

      {/* Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Today's Revenue", val: `₹${analytics.summary.todayRevenue}`, desc: "UPI, cash, card settlements" },
          { label: "Net Profit", val: `₹${analytics.summary.netProfit}`, desc: `Margin: ${analytics.summary.profitMargin}%` },
          { label: "Gross Profit", val: `₹${analytics.summary.grossProfit}`, desc: "Calculated margins" },
          { label: "Average Bill Value", val: `₹${analytics.summary.averageOrderValue}`, desc: "Total customer spend" },
          { label: "Avg Prep Time", val: `${analytics.summary.averagePrepTime || 15} mins`, desc: "Order creation to ready state" },
          { label: "Avg Table Turnover", val: `${analytics.summary.averageTurnoverTime || 45} mins`, desc: "Table scan to billing payment" },
          { label: "All-Time Revenue", val: `₹${analytics.summary.totalRevenue}`, desc: "Cumulative POS earnings" },
          { label: "All-Time Expenses", val: `₹${analytics.summary.totalExpenses}`, desc: "Cumulative operations costs" },
        ].map((stat, idx) => (
          <div key={idx} className="bg-brand-card border border-zinc-850 p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
            <span className="text-[10px] font-bold tracking-wider text-brand-accent uppercase">{stat.label}</span>
            <h3 className="text-2xl font-extrabold text-white">{stat.val}</h3>
            <p className="text-[10px] text-brand-textSecondary mt-1">{stat.desc}</p>
          </div>
        ))}
      </div>

      {/* Graphical charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-brand-card border border-zinc-850 p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider mb-4">
            7-Day Revenue Trend (₹)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.dailyRevenueGraph}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#a1a1aa" fontSize={10} />
                <YAxis stroke="#a1a1aa" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a' }} />
                <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-brand-card border border-zinc-850 p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider mb-4">
            Category Distribution Sales (₹)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.categorySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} />
                <YAxis stroke="#a1a1aa" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a' }} />
                <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
