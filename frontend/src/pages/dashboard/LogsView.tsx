import React from 'react';

interface LogsViewProps {
  activityLogs: any[];
}

const LogsView: React.FC<LogsViewProps> = ({ activityLogs }) => {
  return (
    <div>
      <h2 className="text-xl font-bold text-brand-textPrimary mb-2">Audit trail & system logs</h2>
      <p className="text-xs text-brand-textSecondary mb-6">Auditable chronological ledger of operational actions</p>

      <div className="bg-brand-card border border-zinc-850 rounded-2xl overflow-hidden max-h-[600px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-950 border-b border-zinc-850 text-zinc-400 uppercase text-[10px] sticky top-0">
              <th className="p-4">Action</th>
              <th className="p-4">Details</th>
              <th className="p-4 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {activityLogs.map((log) => (
              <tr key={log.id} className="border-b border-zinc-850/60 text-brand-textPrimary hover:bg-zinc-900/10">
                <td className="p-4 font-bold text-brand-accent">{log.action}</td>
                <td className="p-4 text-brand-textSecondary">{log.details}</td>
                <td className="p-4 text-right font-mono text-zinc-500">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}

            {activityLogs.length === 0 && (
              <tr>
                <td colSpan={3} className="p-12 text-center text-zinc-650">
                  No activity logs loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LogsView;
