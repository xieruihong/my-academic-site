// docs/.vitepress/config.js
export default {
  title: 'Personal academic homepage of Ruihong Xie',
  description: 'Personal academic website',
  
  // 新增关键配置
  base: '/my-academic-site/', // 必须与仓库名一致（重要！）
  outDir: '../dist',        // 构建输出目录
  
  themeConfig: {
    sidebar: {
      '/': [
        {
          text: 'Catalogue',
          collapsible: true,
          items: [
            { text: 'Home', link: '/' },
            // 修正链接格式（推荐使用连字符）
            { text: 'Educational Experience', link: '/educational-experience' },
            { text: 'Awards and Honours', link: '/awards-and-honours' },
            { text: 'Investigation', link: '/investigation' },
            { text: 'Publications', link: '/publications' }
          ]
        }
      ]
    }
  }
}