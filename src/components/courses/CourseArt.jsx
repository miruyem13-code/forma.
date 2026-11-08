import {
  ArrowUpRight,
  Braces,
  Circle,
  Command,
  Layers,
  Play,
  Sparkles,
} from "lucide-react";

export default function CourseArt({ course, className = "" }) {
  if (course.thumbnail)
    return (
      <div className={`course-art ${className}`}>
        <img
          src={course.thumbnail}
          alt={course.title}
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden";
          }}
        />
      </div>
    );
  return (
    <div
      className={`course-art art-${course.art || "ui"} ${className}`}
      aria-hidden="true"
    >
      {course.art === "code" || course.art === "web" ? (
        <>
          <div className="art-kicker">BUILD SOMETHING GREAT</div>
          <div className="code-window">
            <span className="window-dots">● ● ●</span>
            <code>
              <i>const</i> yourNextChapter = () =&gt; {"{"}
              <br />
              &nbsp;&nbsp;<b>return</b> (<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&lt;<em>SomethingAmazing</em> /&gt;
              <br />
              &nbsp;&nbsp;);
              <br />
              {"}"};
            </code>
          </div>
          <div className="floating-symbol">
            <Braces size={29} />
          </div>
        </>
      ) : course.art === "brand" ? (
        <>
          <span className="art-kicker">IDEAS THAT LEAVE A MARK.</span>
          <div className="brand-type">
            Make
            <br />
            <i>your mark.</i>
            <span>✳</span>
          </div>
          <span className="art-foot">
            THE ART OF BRAND STORYTELLING <ArrowUpRight size={16} />
          </span>
        </>
      ) : course.art === "data" ? (
        <>
          <span className="art-kicker">TURN NUMBERS INTO KNOWLEDGE</span>
          <div className="data-card">
            <span>Opportunity, visualized.</span>
            <strong>
              +32.8% <ArrowUpRight size={20} />
            </strong>
            <div className="mini-bars">
              {[30, 48, 42, 68, 56, 78, 96, 82, 110].map((height, i) => (
                <i key={i} style={{ height }} />
              ))}
            </div>
          </div>
          <div className="floating-symbol">
            <span>py</span>
          </div>
        </>
      ) : course.art === "photo" ? (
        <>
          <div className="photo-landscape">
            <div className="sun" />
            <div className="mountain one" />
            <div className="mountain two" />
            <div className="mountain three" />
          </div>
          <span className="photo-caption">
            A different
            <br />
            <i>perspective.</i>
          </span>
          <span className="viewfinder tl" />
          <span className="viewfinder br" />
        </>
      ) : course.art === "product" ? (
        <>
          <span className="art-kicker">LESS GUESSWORK. MORE IMPACT.</span>
          <div className="product-flow">
            <div>
              01 <span>Discover</span>
              <Circle size={14} />
            </div>
            <div>
              02 <span>Build</span>
              <Layers size={14} />
            </div>
            <div>
              03 <span>Make an impact</span>
              <Sparkles size={14} />
            </div>
          </div>
        </>
      ) : course.art === "system" ? (
        <>
          <span className="art-kicker">A SYSTEM FOR YOUR NEXT BIG IDEA</span>
          <div className="system-art">
            <div className="system-colors">
              <i />
              <i />
              <i />
              <i />
            </div>
            <strong>
              Aa <span>Bb</span>
            </strong>
            <div className="system-buttons">
              <span>
                Button <ArrowUpRight size={14} />
              </span>
              <Command />
            </div>
          </div>
        </>
      ) : (
        <>
          <span className="art-kicker">DESIGN A LITTLE DIFFERENTLY.</span>
          <div className="ui-window">
            <div className="ui-sidebar">
              <Layers size={16} />
              <i />
              <i />
              <i />
            </div>
            <div className="ui-content">
              <span>
                Good design.
                <br />
                <b>Great possibilities.</b>
              </span>
              <div className="ui-swatches">
                <i />
                <i />
                <i />
              </div>
              <div className="ui-bottom">
                <div />
                <span>
                  <Play size={14} fill="currentColor" />
                </span>
              </div>
            </div>
          </div>
          <span className="design-cursor">
            <ArrowUpRight size={17} /> Your next idea
          </span>
        </>
      )}
    </div>
  );
}
