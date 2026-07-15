import React from "react";
import { motion } from "framer-motion";

// Reusable slide-transition wrapper for mobile-first page navigation.
// Uses fixed inset-0 so it becomes the positioning context for child
// fixed/absolute elements (preserves Vivi's fixed layout, AuthLayout
// centering, and scroll-container pages alike).
export default function PageTransition({ children }) {
  return (
    <motion.div
      className="fixed inset-0 overflow-y-auto overscroll-contain"
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}