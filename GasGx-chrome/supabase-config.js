export const SUPABASE_CONFIG = Object.freeze({
  url: "https://mkpcliytqudclkwtewru.supabase.co",
  key: "sb_publishable_S2uWAddQEXhWJgGeIF_ZbQ_H_thz2hw",
  table: "robot_collection_posts",
  onConflict: "platform,url",
  platformDefaults: {
    linkedin: {
      publisher: "LinkedIn"
    },
    x: {
      publisher: "X"
    },
    web: {
      publisher: "GasGx Web"
    }
  }
});
