import p from "./premium.module.css";

export function ChannelConnector({ short = false }: { short?: boolean }) {
  const paths = short ? ["M0 90H160"] : ["M0 25C90 25 45 90 160 90", "M0 90H160", "M0 155C90 155 45 90 160 90"];
  return <div className={`${p.connector} ${short ? p.shortConnector : ""}`} aria-hidden="true">
    <svg viewBox="0 0 160 180" fill="none">{paths.map((path, i) => {
      const begin = `${-i}s`;
      return <g key={path}><path d={path} /><circle className={p.flowParticle} r="3.2" opacity="0"><animateMotion dur="3s" begin={begin} repeatCount="indefinite" path={path} /><animate attributeName="opacity" dur="3s" begin={begin} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;.18;.82;1" /></circle></g>;
    })}</svg>
    <i className={p.mobileParticle} />
  </div>;
}
