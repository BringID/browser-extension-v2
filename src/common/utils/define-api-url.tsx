import configs from "../../configs"

function defineApiUrl() {
  try {
    return configs.ZUPLO_API_URL || ''
  } catch (err) {
    return ''
  }
}

export default defineApiUrl
