import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

// Visual indicator for pull-to-refresh. Place at the top of a scrollable container.
export default function PullToRefreshIndicator({ pullDistance, refreshing, threshold = 70 }) {
  if (pullDistance === 0 && !refreshing) return null;
  const progress = Math.min(pullDistance / threshold, 1);
  return (
    <div className="flex items-center justify-center overflow-hidden transition-height" style={{ height: pullDistance }}>
      <motion.div
        animate={{ rotate: refreshing ? 360 : progress * 180 }}
        transition={{ duration: refreshing ? 0.8 : 0.2, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
        className={refreshing ? 'text-purple-400' : progress >= 1 ? 'text-purple-300' : 'text-white/40'}
      >
        <RefreshCw className="w-5 h-5" />
      </motion.div>
    </div>
  );
}