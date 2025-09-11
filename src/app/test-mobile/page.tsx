"use client";
import { useMobile } from "@/contexts/MobileContext";
import { Button } from "@/components/ui/button";

export default function TestMobilePage() {
  const { isMobile, isTablet, isDesktop, screenWidth, screenHeight, actualIsMobile, setForceMobileMode, forceMobileMode } = useMobile();

  return (
    <main className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">移动端检测测试页面</h1>
        
        {/* 检测结果 */}
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold mb-3">检测结果</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>屏幕宽度:</strong> {screenWidth}px</p>
              <p><strong>屏幕高度:</strong> {screenHeight}px</p>
              <p><strong>设备类型:</strong> {isMobile ? '手机' : isTablet ? '平板' : '桌面'}</p>
            </div>
            <div>
              <p><strong>强制移动模式:</strong> {forceMobileMode ? '是' : '否'}</p>
              <p><strong>实际移动端:</strong> {actualIsMobile ? '是' : '否'}</p>
            </div>
          </div>
        </div>

        {/* User Agent */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-2">User Agent</h3>
          <p className="text-sm break-all">{userAgent}</p>
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-4 mb-6">
          <Button onClick={() => setForceMobileMode(!actualIsMobile)}>
            {actualIsMobile ? '切换到桌面端' : '切换到移动端'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
          >
            刷新页面
          </Button>
        </div>

        {/* 布局测试 */}
        <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg">
          <h3 className="font-semibold mb-4">布局测试</h3>
          
          {actualIsMobile ? (
            <div className="space-y-4">
              <div className="bg-green-100 p-4 rounded">
                <h4 className="font-semibold text-green-800">移动端布局</h4>
                <p className="text-sm text-green-700">当前显示移动端界面</p>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <div className="bg-blue-100 p-2 rounded text-sm">移动端卡片 1</div>
                <div className="bg-blue-100 p-2 rounded text-sm">移动端卡片 2</div>
                <div className="bg-blue-100 p-2 rounded text-sm">移动端卡片 3</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-100 p-4 rounded">
                <h4 className="font-semibold text-blue-800">桌面端布局</h4>
                <p className="text-sm text-blue-700">当前显示桌面端界面</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-100 p-4 rounded text-sm">桌面端卡片 1</div>
                <div className="bg-gray-100 p-4 rounded text-sm">桌面端卡片 2</div>
                <div className="bg-gray-100 p-4 rounded text-sm">桌面端卡片 3</div>
              </div>
            </div>
          )}
        </div>

        {/* 响应式测试 */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-semibold mb-2">响应式测试</h3>
          <p className="text-sm text-yellow-700">
            请尝试调整浏览器窗口大小或旋转设备，观察检测结果的变化。
          </p>
        </div>
      </div>
    </main>
  );
}
