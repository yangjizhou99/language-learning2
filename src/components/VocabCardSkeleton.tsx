import { motion } from 'framer-motion';

export function VocabCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-3 sm:p-4">
      {/* 头部骨架 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* 复选框骨架 */}
          <div className="w-5 h-5 bg-gray-200 rounded animate-pulse mt-1"></div>
          
          <div className="flex-1 space-y-2">
            {/* 标题骨架 */}
            <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4"></div>
            
            {/* 标签骨架 */}
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="h-5 w-12 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
        
        {/* 播放按钮骨架 */}
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
      </div>
      
      {/* 释义骨架 */}
      <div className="pl-8 space-y-2">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6"></div>
      </div>
    </div>
  );
}

export function VocabListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
        >
          <VocabCardSkeleton />
        </motion.div>
      ))}
    </div>
  );
}

