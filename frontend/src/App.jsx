import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import CustomCursor from './components/CustomCursor';
import Auth from './Auth';
import VerifyEmail from './VerifyEmail';
import History from './History';

gsap.registerPlugin(ScrollTrigger);

const Navbar = ({ isAuthenticated, onLogout, currentView, onViewChange }) => {
  return (
    <nav className="w-full px-[5%] py-6 flex justify-between items-center max-w-[1400px] mx-auto z-50 relative">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => onViewChange && onViewChange('generator')}>
        <div className="flex items-center gap-2">
          <img src="/normalImage.png" alt="Logo Icon" className="w-10 h-10 object-contain drop-shadow-md" />
          <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
            ByTE <span className="font-medium opacity-80">Report Generator</span>
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-8">
        {['Home', 'About', 'How it Works', 'Contact Us'].map((link) => (
          <a key={link} href={`#${link.toLowerCase().replace(/\s+/g, '-')}`} className="text-white/80 hover:text-white transition-colors text-sm font-medium">
            {link}
          </a>
        ))}
        {isAuthenticated ? (
          <div className="flex items-center gap-4">
            <button
              onClick={() => onViewChange(currentView === 'generator' ? 'history' : 'generator')}
              className="text-white/80 hover:text-white transition-colors text-sm font-bold uppercase tracking-wide"
            >
              {currentView === 'generator' ? 'My Reports' : 'Generate'}
            </button>
            <button onClick={onLogout} className="btn-green text-sm !bg-red-500/20 !text-red-400 !border-red-500/50 hover:!bg-red-500 hover:!text-white">
              Logout
            </button>
          </div>
        ) : (
          <button className="btn-green text-sm">
            Generate Report Now
          </button>
        )}
      </div>

      <div className="md:hidden flex flex-col gap-1.5 cursor-pointer">
        <span className="block h-0.5 w-6 bg-white"></span>
        <span className="block h-0.5 w-6 bg-white"></span>
      </div>
    </nav>
  );
};

const SectionHeading = ({ children, subtitle }) => (
  <div className="space-y-4 mb-12 animate-on-scroll">
    <h2 className="text-4xl md:text-5xl font-bold">{children}</h2>
    {subtitle && <p className="text-white/60 max-w-2xl mx-auto text-lg">{subtitle}</p>}
    <div className="w-24 h-1 bg-byte-green mx-auto rounded-full"></div>
  </div>
);

const FeatureCard = ({ icon, title, description }) => (
  <div className="glass-gradient p-8 rounded-3xl text-center space-y-4 transition-all hover:scale-[1.02] hover:border-white/30 animate-on-scroll">
    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-byte-blue mb-4 shadow-inner">
      {icon}
    </div>
    <h3 className="text-xl font-bold">{title}</h3>
    <p className="text-white/50 text-sm leading-relaxed">{description}</p>
  </div>
);

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentView, setCurrentView] = useState('generator'); // 'generator' or 'history'
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [progress, setProgress] = useState(0);
  const [reportCount, setReportCount] = useState(5);
  const [contactStatus, setContactStatus] = useState({ type: '', message: '' });
  const [downloadUrl, setDownloadUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    setContactStatus({ type: 'info', message: 'Sending message...' });

    try {
      const response = await fetch('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        setContactStatus({ type: 'success', message: 'Message sent successfully!' });
        e.target.reset();
      } else {
        throw new Error('Failed to send message');
      }
    } catch (err) {
      setContactStatus({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    // Initial reveal
    gsap.fromTo(".hero-content > *",
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.2, ease: "power3.out" }
    );

    // Scroll reveal animations
    gsap.utils.toArray(".animate-on-scroll").forEach((elem) => {
      gsap.fromTo(elem,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: elem,
            start: "top 85%",
          }
        }
      );
    });
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setDownloadUrl(null);
      setStatus({ type: '', message: '' });
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(10);
    setStatus({ type: 'info', message: 'Analyzing data...' });

    const interval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + 10 : 90));
    }, 500);

    const formData = new FormData();
    formData.append('file', file);
    if (reportCount) {
      formData.append('count', reportCount);
    }

    try {
      const response = await fetch('/generate-reports', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        clearInterval(interval);
        setProgress(100);
        setStatus({ type: 'success', message: 'Report generated successfully!' });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setDownloadUrl(url);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'report.zip';
        a.click();
        setLoading(false);
      } else {
        if (response.status === 401) {
          setToken(null);
          localStorage.removeItem('token');
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to generate report');
      }
    } catch (err) {
      clearInterval(interval);
      setStatus({ type: 'error', message: err.message });
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  const isVerifyRoute = window.location.pathname === '/verify';

  if (isVerifyRoute) {
    return (
      <div className="min-h-screen selection:bg-byte-green/30 relative">
        <CustomCursor />
        <Navbar isAuthenticated={false} />
        <VerifyEmail />
        <footer className="w-full text-center py-10 border-t border-white/5 space-y-6 text-sm text-white/40 bg-black/40 backdrop-blur-xl relative z-20 mt-20">
          <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center px-6 gap-6">
            <div className="flex flex-col items-center md:items-start gap-1">
              <p className="font-bold text-white/60">© 2024 ByTE Report Generator.</p>
              <p className="text-[10px] uppercase tracking-tighter">Empowering Educators through Intelligent Data Analysis.</p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen selection:bg-byte-green/30 relative">
      <CustomCursor />

      {token ? (
        <>
          <Navbar
            isAuthenticated={true}
            onLogout={handleLogout}
            currentView={currentView}
            onViewChange={setCurrentView}
          />
          <main className="max-w-[1200px] mx-auto px-6 space-y-32 relative z-10">

            {currentView === 'history' ? (
              <History token={token} />
            ) : (
              <>
                {/* SECTION: HERO & UPLOAD */}
                <section id="home" className="pt-12 text-center space-y-16">
                  <div className="hero-content space-y-10">
                    <div className="flex flex-col items-center space-y-6">
                      <div className="flex items-center justify-center space-x-4">
                        <img src="/normalImage.png" alt="ByTE Logo" className="w-[80px] drop-shadow-2xl animate-float" />
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">ByTE <span className="font-medium opacity-80 text-white/70">Report Generator</span></h1>
                      </div>

                      <div className="space-y-4">
                        <h2 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white">
                          Professional Student Performance Reports <br /> in Seconds, Not Hours.
                        </h2>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto font-medium leading-relaxed">
                          Simply upload your Excel or CSV data. We handle the analysis, <br /> formatting, and insight generation for you.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-center py-8">
                      <img src="/normalImage.png" alt="Laptop Visual" className="w-full max-w-[700px] drop-shadow-[0_30px_60px_rgba(0,100,255,0.3)]" />
                    </div>
                  </div>

                  <div className="glass-upload p-12 max-w-[850px] mx-auto space-y-10">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2 shadow-inner border border-white/5">
                        <svg className="w-8 h-8 text-byte-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold text-white/90">
                        {file ? file.name : "Ready to start? Drag & drop your file here"}
                      </p>
                      {!file && <p className="text-white/40 font-medium italic">Supports .csv, .xlsx, .xls</p>}
                    </div>

                    <button onClick={() => fileInputRef.current.click()} className="btn-green text-xl px-14 py-4 rounded-xl shadow-[0_0_20px_rgba(118,200,89,0.3)]">
                      {loading ? 'Processing...' : (file ? 'Change File' : 'Find Your File')}
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />

                    {file && !loading && !downloadUrl && (
                      <div className="flex flex-col items-center gap-4 animate-fadeIn">
                        <div className="flex items-center gap-3 glass-gradient px-6 py-3 rounded-2xl border border-white/20">
                          <label className="text-white/60 font-bold text-sm uppercase tracking-wider">Reports to Generate:</label>
                          <input
                            type="number"
                            value={reportCount}
                            onChange={(e) => setReportCount(e.target.value)}
                            min="1"
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 w-20 text-center font-bold text-byte-green focus:outline-none focus:border-byte-green transition-colors"
                          />
                        </div>
                        <button onClick={handleGenerate} className="block mx-auto text-byte-green font-extrabold hover:text-white transition-all text-lg group">
                          Generate My Reports <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                        </button>
                      </div>
                    )}

                    {downloadUrl && !loading && (
                      <div className="flex flex-col items-center gap-6 animate-fadeIn">
                        <div className="p-4 rounded-xl text-byte-green bg-byte-green/10 border border-byte-green/30 text-lg font-bold">
                          {status.message || 'Report generated successfully!'}
                        </div>
                        <a href={downloadUrl} download="report.zip" className="btn-green text-xl py-4 px-10 rounded-xl shadow-[0_0_20px_rgba(118,200,89,0.4)] hover:shadow-[0_0_30px_rgba(118,200,89,0.6)] no-underline flex items-center justify-center gap-3">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Download Reports (ZIP)
                        </a>
                        <button onClick={() => {
                          setFile(null);
                          setDownloadUrl(null);
                          setStatus({ type: '', message: '' });
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }} className="text-white/50 hover:text-white transition-colors underline-offset-4 hover:underline text-sm font-bold uppercase tracking-wider mt-2">
                          Start Over
                        </button>
                      </div>
                    )}

                    {loading && (
                      <div className="space-y-4">
                        <div className="flex justify-between text-sm font-bold text-white/60 uppercase tracking-widest">
                          <span>Analyzing Patterns</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <div className="h-full bg-byte-green transition-all duration-700 shadow-[0_0_15px_#69BE4F]" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* SECTION: ABOUT */}
                <section id="about" className="space-y-16 py-20">
                  <SectionHeading subtitle="ByTE is more than just a converter; it's an intelligent reporting engine designed for educators.">
                    What is ByTE?
                  </SectionHeading>
                  <div className="grid md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-6 text-left">
                      <h3 className="text-3xl font-bold text-white/90">Data-Driven Insights for Every Student</h3>
                      <p className="text-white/50 leading-relaxed text-lg">
                        ByTE Report Generator bridges the gap between raw data collection and comprehensive reporting. Whether you have grades from a full semester or attendance records, ByTE parses the complex structures within your files to create readable, beautifully formatted reports.
                      </p>
                      <ul className="space-y-4">
                        {[
                          'Automated trend identification in student performance',
                          'One-click student summary generation',
                          'Customizable templates for different academic levels',
                          'Secure, local-first processing ensures student privacy'
                        ].map((item, i) => (
                          <li key={i} className="flex gap-3 text-white/80">
                            <span className="text-byte-green font-bold">✓</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="glass-gradient p-2 rounded-[40px] shadow-2xl overflow-hidden">
                      <div className="bg-black/40 rounded-[38px] p-8 space-y-6 border border-white/10">
                        <div className="flex gap-4 items-center">
                          <div className="w-12 h-12 rounded-lg bg-byte-blue/20 flex items-center justify-center">📊</div>
                          <div className="flex-1 h-3 bg-white/5 rounded-full">
                            <div className="w-[85%] h-full bg-byte-blue rounded-full"></div>
                          </div>
                        </div>
                        <div className="flex gap-4 items-center">
                          <div className="w-12 h-12 rounded-lg bg-byte-green/20 flex items-center justify-center">📈</div>
                          <div className="flex-1 h-3 bg-white/5 rounded-full">
                            <div className="w-[65%] h-full bg-byte-green rounded-full"></div>
                          </div>
                        </div>
                        <div className="pt-4 text-center">
                          <p className="text-sm font-medium text-white/40 italic">Aggregated Student Growth Analysis Example</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* SECTION: HOW IT WORKS */}
                <section id="how-it-works" className="space-y-16">
                  <SectionHeading subtitle="Three simple steps to professional reporting.">
                    How it Works
                  </SectionHeading>
                  <div className="grid md:grid-cols-3 gap-8 relative">
                    <div className="hidden md:block absolute top-[40px] left-[20%] right-[20%] h-0.5 border-t border-dashed border-white/10 -z-10"></div>
                    {[
                      { step: '01', title: 'Upload Data', text: 'Upload your student data file in Excel or CSV format. Our system supports various standard academic data formats.' },
                      { step: '02', title: 'Smart Analysis', text: 'ByTE analyzes individual student metrics, identifying key strengths and areas needing improvement automatically.' },
                      { step: '03', title: 'Get Reports', text: 'Instantly download a ZIP folder containing individual student reports, ready for printing or digital distribution.' }
                    ].map((item, i) => (
                      <div key={i} className="space-y-6 text-center animate-on-scroll">
                        <div className="w-20 h-20 rounded-2xl glass-gradient mx-auto flex items-center justify-center text-3xl font-black text-byte-green shadow-lg border border-white/20">
                          {item.step}
                        </div>
                        <h3 className="text-2xl font-bold">{item.title}</h3>
                        <p className="text-white/40 leading-relaxed px-4">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* SECTION: FEATURES & STATS */}
                <section className="space-y-16 py-10">
                  <div className="grid md:grid-cols-4 gap-8">
                    {[
                      { label: 'Reports Generated', value: '15,000+' },
                      { label: 'Time Saved Daily', value: '4.5 hrs' },
                      { label: 'Accuracy Rate', value: '99.9%' },
                      { label: 'Satisfied Users', value: '1,200+' }
                    ].map((stat, i) => (
                      <div key={i} className="glass-gradient p-8 rounded-3xl text-center space-y-2 border border-white/5 animate-on-scroll">
                        <p className="text-3xl font-black text-white">{stat.value}</p>
                        <p className="text-white/30 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-3 gap-8">
                    <FeatureCard
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                      title="Enterprise Security"
                      description="Your data never leaves your browser where possible. We prioritize extreme privacy for student records."
                    />
                    <FeatureCard
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                      title="Ultra Fast"
                      description="Process files with up to 10,000 entries in under 30 seconds. No more waiting on slow legacy software."
                    />
                    <FeatureCard
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 01.3-.7l7-7a1 1 0 011.4 0l7 7a1 1 0 01.3.7V19a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" /></svg>}
                      title="Custom Templates"
                      description="Tailor your reports with multiple templates. Ensure they match your school's branding effortlessly."
                    />
                  </div>
                </section>

                {/* SECTION: CONTACT */}
                <section id="contact-us" className="space-y-16 py-20 pb-40">
                  <SectionHeading subtitle="Have questions or need technical support? We're here to help.">
                    Get In Touch
                  </SectionHeading>
                  <form onSubmit={handleContactSubmit} className="glass-upload p-12 max-w-[800px] mx-auto text-left space-y-8 animate-on-scroll">
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Your Name</label>
                        <input name="name" type="text" required placeholder="John Doe" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:border-byte-green transition-colors text-white" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Email Address</label>
                        <input name="email" type="email" required placeholder="john@school.edu" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:border-byte-green transition-colors text-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">How can we help?</label>
                      <textarea name="message" required rows="4" placeholder="Describe your inquiry..." className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:border-byte-green transition-colors text-white resize-none"></textarea>
                    </div>

                    {contactStatus.message && (
                      <div className={`p-4 rounded-xl text-sm font-bold ${contactStatus.type === 'success' ? 'bg-byte-green/20 text-byte-green' : 'bg-red-500/20 text-red-400'}`}>
                        {contactStatus.message}
                      </div>
                    )}

                    <button type="submit" className="btn-green w-full py-5 text-lg shadow-[0_10px_30px_rgba(118,200,89,0.2)]">
                      Send Message
                    </button>
                  </form>
                </section>
              </>
            )}
          </main>

          <footer className="w-full text-center py-10 border-t border-white/5 space-y-6 text-sm text-white/40 bg-black/40 backdrop-blur-xl relative z-20">
            <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center px-6 gap-6">
              <div className="flex flex-col items-center md:items-start gap-1">
                <p className="font-bold text-white/60">© 2024 ByTE Report Generator.</p>
                <p className="text-[10px] uppercase tracking-tighter">Empowering Educators through Intelligent Data Analysis.</p>
              </div>
              <div className="flex gap-8">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-white transition-colors">Documentation</a>
              </div>
              <div className="flex gap-4">
                {['f', 't', 'in'].map(soc => (
                  <div key={soc} className="w-10 h-10 rounded-xl glass-gradient flex items-center justify-center hover:bg-white/10 hover:text-white cursor-pointer transition-all border border-white/5">
                    {soc}
                  </div>
                ))}
              </div>
            </div>
          </footer>
        </>
      ) : (
        <>
          <Navbar isAuthenticated={false} />
          <Auth onLogin={(newToken) => setToken(newToken)} />
          <footer className="w-full text-center py-10 border-t border-white/5 space-y-6 text-sm text-white/40 bg-black/40 backdrop-blur-xl relative z-20 mt-20">
            <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center px-6 gap-6">
              <div className="flex flex-col items-center md:items-start gap-1">
                <p className="font-bold text-white/60">© 2024 ByTE Report Generator.</p>
                <p className="text-[10px] uppercase tracking-tighter">Empowering Educators through Intelligent Data Analysis.</p>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

export default App;