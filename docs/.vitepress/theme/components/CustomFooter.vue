 <template>
  <footer class="custom-footer">
    <div class="footer-message" v-html="$themeConfig.footer.message"></div>
    <div class="footer-copyright" v-html="$themeConfig.footer.copyright"></div>
  </footer>
</template>

<style scoped>
.custom-footer {
  margin-top: 4rem;
  padding: 2rem 1rem;
  text-align: center;
  border-top: 1px solid var(--vp-c-divider);
}

.footer-message {
  color: var(--vp-c-text-2);
  margin-bottom: 1rem;
}

.footer-copyright {
  font-size: 0.9em;
  color: var(--vp-c-text-3);
}
</style>