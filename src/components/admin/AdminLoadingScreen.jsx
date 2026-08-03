
import logo from '../../assets/images/logo.webp'

export default function AdminLoadingScreen({
  title = 'Opening your private workspace...',
  message = 'Confirming secure access and preparing The Studio.',
}) {
  return (
    <>

<style>{`
.pwc-admin-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  position: fixed;
  inset: 0;
  z-index: 9999;
  background-color: #fbf6f3;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}
.pwc-admin-loading__background {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.pwc-admin-loading__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.5;
  animation: pwc-loading-pulse 8s infinite alternate ease-in-out;
}
.pwc-admin-loading__glow--1 {
  top: 10%; left: 20%; width: 40vw; height: 40vw;
  background: radial-gradient(circle, rgba(230,178,160,0.6) 0%, transparent 70%);
}
.pwc-admin-loading__glow--2 {
  bottom: 10%; right: 20%; width: 50vw; height: 50vw;
  background: radial-gradient(circle, rgba(160,190,230,0.6) 0%, transparent 70%);
  animation-delay: -3s;
}
.pwc-admin-loading__glow--3 {
  top: 40%; left: 50%; transform: translate(-50%, -50%); width: 60vw; height: 60vw;
  background: radial-gradient(circle, rgba(243,230,225,0.8) 0%, transparent 70%);
  animation-delay: -5s;
}
@keyframes pwc-loading-pulse {
  0% { transform: scale(0.9) translate(0, 0); opacity: 0.4; }
  100% { transform: scale(1.1) translate(20px, -20px); opacity: 0.7; }
}
.pwc-admin-loading__card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px;
}
.pwc-admin-loading__spinner {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 32px;
}
.pwc-admin-loading__spinner svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  animation: pwc-spin 2s linear infinite;
}
.pwc-admin-loading__spinner-track { fill: none; stroke: rgba(43, 27, 23, 0.1); stroke-width: 4; }
.pwc-admin-loading__spinner-head {
  fill: none; stroke: #2b1b17; stroke-width: 4; stroke-linecap: round;
  stroke-dasharray: 200; stroke-dashoffset: 40;
  animation: pwc-spin-dash 1.5s ease-in-out infinite;
}
@keyframes pwc-spin { 100% { transform: rotate(360deg); } }
@keyframes pwc-spin-dash {
  0% { stroke-dasharray: 1, 300; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 140, 300; stroke-dashoffset: -40; }
  100% { stroke-dasharray: 140, 300; stroke-dashoffset: -280; }
}
.pwc-admin-loading__logo {
  position: absolute;
  top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 64px; height: 64px; border-radius: 50%; object-fit: cover;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.pwc-admin-loading__eyebrow {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;
  color: #7c726c; margin-bottom: 12px;
}
.pwc-admin-loading__title {
  font-family: "Playfair Display", serif;
  font-size: 32px; font-weight: 500; color: #2b1b17; margin: 0 0 12px; letter-spacing: -0.02em;
}
.pwc-admin-loading__message {
  font-size: 16px; color: #574b46; margin: 0; max-width: 320px; line-height: 1.5;
}
`}</style>
      <main
      id="main-content"
      className="pwc-admin-loading"
      tabIndex={-1}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pwc-admin-loading__background">
        <div className="pwc-admin-loading__glow pwc-admin-loading__glow--1" />
        <div className="pwc-admin-loading__glow pwc-admin-loading__glow--2" />
        <div className="pwc-admin-loading__glow pwc-admin-loading__glow--3" />
      </div>

      <div className="pwc-admin-loading__card">
        <div className="pwc-admin-loading__spinner">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" className="pwc-admin-loading__spinner-track" />
            <circle cx="50" cy="50" r="45" className="pwc-admin-loading__spinner-head" />
          </svg>
          <img src={logo} alt="" className="pwc-admin-loading__logo" aria-hidden="true" />
        </div>

        <p className="pwc-admin-loading__eyebrow">Power Within - The Studio</p>
        <h1 className="pwc-admin-loading__title">{title}</h1>
        <p className="pwc-admin-loading__message">{message}</p>
      </div>
    </main>
    </>
  )
}
