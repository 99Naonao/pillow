# 清理未使用的 TDesign 組件

## 🎯 目標

通過刪除未使用的 TDesign 組件來減小 `miniprogram_npm` 文件夾的大小，從而減小整個小程序的包大小。

## 📊 當前使用情況

根據分析，你的項目只使用了以下 TDesign 組件：

- **calendar** - 在 `pages/report/report.json` 中使用
- **icon** - 在 `components/HeaderNavBar/headerNav.json` 中使用

## 🧹 清理方法

### 方法 1: 使用 PowerShell 腳本（推薦）

1. 在項目根目錄下右鍵選擇 "在終端中打開"
2. 運行以下命令：

```powershell
.\clean-components.ps1
```

### 方法 2: 手動刪除

手動刪除以下目錄（保留 `calendar` 和 `icon`）：

```
miniprogram_npm/tdesign-miniprogram/
├── action-sheet/          ❌ 刪除
├── avatar/                ❌ 刪除
├── avatar-group/          ❌ 刪除
├── back-top/              ❌ 刪除
├── badge/                 ❌ 刪除
├── button/                ❌ 刪除
├── cascader/              ❌ 刪除
├── cell/                  ❌ 刪除
├── cell-group/            ❌ 刪除
├── check-tag/             ❌ 刪除
├── checkbox/              ❌ 刪除
├── checkbox-group/        ❌ 刪除
├── col/                   ❌ 刪除
├── collapse/              ❌ 刪除
├── collapse-panel/        ❌ 刪除
├── color-picker/          ❌ 刪除
├── count-down/            ❌ 刪除
├── date-time-picker/      ❌ 刪除
├── dialog/                ❌ 刪除
├── divider/               ❌ 刪除
├── drawer/                ❌ 刪除
├── dropdown-item/         ❌ 刪除
├── dropdown-menu/         ❌ 刪除
├── empty/                 ❌ 刪除
├── fab/                   ❌ 刪除
├── footer/                ❌ 刪除
├── grid/                  ❌ 刪除
├── grid-item/             ❌ 刪除
├── guide/                 ❌ 刪除
├── image/                 ❌ 刪除
├── image-viewer/          ❌ 刪除
├── indexes/               ❌ 刪除
├── indexes-anchor/        ❌ 刪除
├── input/                 ❌ 刪除
├── link/                  ❌ 刪除
├── loading/               ❌ 刪除
├── message/               ❌ 刪除
├── message-item/          ❌ 刪除
├── navbar/                ❌ 刪除
├── notice-bar/            ❌ 刪除
├── overlay/               ❌ 刪除
├── picker/                ❌ 刪除
├── picker-item/           ❌ 刪除
├── popup/                 ❌ 刪除
├── progress/              ❌ 刪除
├── pull-down-refresh/     ❌ 刪除
├── radio/                 ❌ 刪除
├── radio-group/           ❌ 刪除
├── rate/                  ❌ 刪除
├── result/                ❌ 刪除
├── row/                   ❌ 刪除
├── scroll-view/           ❌ 刪除
├── search/                ❌ 刪除
├── side-bar/              ❌ 刪除
├── side-bar-item/         ❌ 刪除
├── skeleton/              ❌ 刪除
├── slider/                ❌ 刪除
├── step-item/             ❌ 刪除
├── stepper/               ❌ 刪除
├── steps/                 ❌ 刪除
├── sticky/                ❌ 刪除
├── swipe-cell/            ❌ 刪除
├── swiper/                ❌ 刪除
├── swiper-nav/            ❌ 刪除
├── switch/                ❌ 刪除
├── tab-bar/               ❌ 刪除
├── tab-bar-item/          ❌ 刪除
├── tab-panel/             ❌ 刪除
├── tabs/                  ❌ 刪除
├── tag/                   ❌ 刪除
├── textarea/              ❌ 刪除
├── toast/                 ❌ 刪除
├── transition/            ❌ 刪除
├── tree-select/           ❌ 刪除
├── upload/                ❌ 刪除
├── calendar/              ✅ 保留
├── icon/                  ✅ 保留
├── index.js               ✅ 保留
├── index.d.ts             ✅ 保留
├── .wechatide.ib.json     ✅ 保留
├── common/                ✅ 保留
└── mixins/                ✅ 保留
```

## 📈 預期效果

- **刪除組件數量**: 65+ 個
- **預計節省空間**: 60-80%
- **保留功能**: 完全正常（只保留使用的組件）

## ⚠️ 注意事項

1. **備份**: 建議在清理前備份整個 `miniprogram_npm` 文件夾
2. **測試**: 清理後請測試小程序功能是否正常
3. **恢復**: 如果出現問題，可以重新運行 `npm install` 恢復

## 🔄 如果需要其他組件

如果後續需要使用其他 TDesign 組件，可以：

1. 重新運行 `npm install` 恢復所有組件
2. 手動複製需要的組件目錄
3. 修改 `package.json` 添加新的依賴

## 📝 清理後檢查

清理完成後，檢查以下文件是否正常：

- `pages/report/report.json` - 日曆組件
- `components/HeaderNavBar/headerNav.json` - 圖標組件

## 🎉 完成

清理完成後，你的小程序包大小應該會顯著減小，同時保持所有功能正常運行！ 