export default function manifest() {
  return {
    name: "Cook With Joe",
    short_name: "Cook With Joe",
    description:
      "Step-by-step cooking videos you can control by voice or by tapping the step you're on.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF3E8",
    theme_color: "#5C6670",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
