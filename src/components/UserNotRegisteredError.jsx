import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-zinc-50 p-4">
      <div className="max-w-md w-full p-8 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl -z-10" />

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-500/10 border border-orange-500/20">
            <svg className="w-8 h-8 text-orange-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight text-white mb-3">Access Restricted</h1>
          <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
            You are not registered to use this application. Please contact the app administrator to request access.
          </p>

          <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-300 text-left">
            <p className="font-semibold text-white mb-2">If you believe this is an error, you can:</p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>Verify you are logged in with the correct account</li>
              <li>Contact the app administrator for access</li>
              <li>Try logging out and back in again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
