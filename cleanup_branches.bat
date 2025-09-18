@echo off
echo === Git分支清理脚本 ===
echo 开始清理Git仓库...

REM 设置Git不使用分页器
git config core.pager ""

echo 当前所有本地分支：
git branch

echo.
echo 开始删除除main和数据库分开处理之外的所有分支...

REM 删除分支列表（从之前看到的分支名）
git branch -D aipbug
git branch -D bug处理
git branch -D cloze优化
git branch -D shadowing-手机界面优化
git branch -D shadowing-推荐难度
git branch -D shadowing生成逻辑调整
git branch -D shadowing生成重构
git branch -D shadowing界面优化
git branch -D shadowing界面翻译
git branch -D shadowing识别评分问题修复
git branch -D 任务练习
git branch -D 优化性能
git branch -D 优化操作手机端
git branch -D 修复bug
git branch -D 修复题目单次生成的bug
git branch -D 修改生词选中逻辑
git branch -D 加入不到题库的bug
git branch -D 加入谷歌gemini-tts
git branch -D 合成失败-bug
git branch -D 启动测试
git branch -D 导入科大讯飞服务
git branch -D 小建议shadowing
git branch -D 小改进
git branch -D 并发生成问题调整
git branch -D 手机端bug
git branch -D 数据库分离
git branch -D 数据库安全bug

echo.
echo 清理远程跟踪分支...
git remote prune origin

echo.
echo 当前剩余分支：
git branch

echo.
echo === 清理完成 ===
pause
