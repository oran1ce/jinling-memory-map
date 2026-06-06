const pages = [
  'pages/map/index',
  'pages/marker-create/index',
  'pages/marker-detail/index',
  'pages/story-line/index',
  'pages/login/index',
  'pages/profile/index',
  'pages/user-profile/index'
]

export default defineAppConfig({
  pages,
  tabBar: {
    color: '#8B7E74',
    selectedColor: '#4A315D',
    backgroundColor: '#F9F6F0',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/map/index',
        text: '地图',
        iconPath: './assets/icons/map_unselected.png',
        selectedIconPath: './assets/icons/map_selected.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: './assets/icons/profile_unselected.png',
        selectedIconPath: './assets/icons/profile_selected.png'
      }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F9F6F0',
    navigationBarTitleText: '金陵拾光记',
    navigationBarTextStyle: 'black'
  }
})
