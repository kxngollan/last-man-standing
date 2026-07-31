import { ImageResponse } from "next/og";

// iOS home-screen icon. Apple needs a non-transparent PNG (it applies its own
// rounded mask), so we render the shield centred on the brand's cream paper.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f3ea",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2 3 5.5v6c0 5 3.8 8.6 9 10.5 5.2-1.9 9-5.5 9-10.5v-6L12 2Z"
            fill="#d1563b"
          />
          <path
            d="m8.1 12 2.7 2.7L16 9.2"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
