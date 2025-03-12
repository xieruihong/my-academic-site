 import DefaultTheme from 'vitepress/theme'
import './styles/main.scss'
import CustomFooter from './components/CustomFooter.vue'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('CustomFooter', CustomFooter)
  }
}