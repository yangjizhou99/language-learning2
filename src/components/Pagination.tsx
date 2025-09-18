'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  showItemsPerPage?: boolean;
  showPageInput?: boolean;
  maxVisiblePages?: number;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
  showPageInput = true,
  maxVisiblePages = 5,
  className = '',
}: PaginationProps) {
  const t = useTranslation();
  // 如果只有一页，不显示分页
  if (totalPages <= 1) return null;

  // 计算显示的页码范围
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const half = Math.floor(maxVisiblePages / 2);

    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, currentPage + half);

    // 调整范围以确保显示足够的页码
    if (end - start + 1 < maxVisiblePages) {
      if (start === 1) {
        end = Math.min(totalPages, start + maxVisiblePages - 1);
      } else {
        start = Math.max(1, end - maxVisiblePages + 1);
      }
    }

    // 添加第一页和省略号
    if (start > 1) {
      pages.push(1);
      if (start > 2) {
        pages.push('...');
      }
    }

    // 添加中间页码
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // 添加最后一页和省略号
    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push('...');
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= totalPages) {
      onPageChange(value);
    }
  };

  const handleItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value);
    onItemsPerPageChange(newItemsPerPage);
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* 顶部：显示条目信息 */}
      <div className="text-sm text-gray-600 text-center sm:text-left">
        {totalItems > 0 ? (
          <span>
            {t.vocabulary.pagination.showing_items
              .replace('{start}', startItem.toString())
              .replace('{end}', endItem.toString())
              .replace('{total}', totalItems.toString())}
          </span>
        ) : (
          <span>{t.vocabulary.pagination.no_data}</span>
        )}
      </div>

      {/* 中间：分页控件 */}
      <div className="flex items-center justify-center gap-1 sm:gap-2">
        {/* 首页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="hidden sm:flex h-8 w-8 p-0"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* 上一页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* 页码按钮 */}
        <div className="flex items-center gap-1">
          {visiblePages.map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-2 sm:px-3 py-2 text-sm text-gray-500">...</span>
              ) : (
                <Button
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(page as number)}
                  className="min-w-[32px] sm:min-w-[40px] h-8 text-xs sm:text-sm"
                >
                  {page}
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* 下一页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* 末页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="hidden sm:flex h-8 w-8 p-0"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 底部：每页显示条数和跳转 */}
      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-3 sm:gap-4">
        {/* 每页显示条数选择 */}
        {showItemsPerPage && (
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-600">{t.vocabulary.pagination.per_page}</span>
            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger className="w-16 sm:w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs sm:text-sm text-gray-600">{t.vocabulary.pagination.items}</span>
          </div>
        )}

        {/* 跳转到指定页面 */}
        {showPageInput && (
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-600">{t.vocabulary.pagination.go_to}</span>
            <Input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={handlePageInputChange}
              className="w-12 sm:w-16 h-8 text-center text-xs sm:text-sm"
            />
            <span className="text-xs sm:text-sm text-gray-600">{t.vocabulary.pagination.page}</span>
          </div>
        )}
      </div>
    </div>
  );
}
