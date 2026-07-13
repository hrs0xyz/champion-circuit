import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { PageContainer } from '../ui/PageContainer';

const FOUNDERS = [
  {
    name: 'Puspal Bag',
    role: 'CEO, Director & Founder',
    note: 'Former Director at Lets Game Now. 10+ years of experience in eSports industry. Represented India in eFIBA esports Season 1 & 2.',
    photo: '/founders/puspul-bag.png',
  },
  {
    name: 'Priyanka Mondal',
    role: 'CDO, Co-Founder & Director',
    note: 'Ex-Assistant Operation Manager at Lets Game Now. 5+ Years of experience in the esports Industry. Hosted Asian Games India Qualifier 2022 (FIFA 22) & 2026 & eISL 2024.',
    photo: '/founders/priyanka-mondal.png',
  },
  {
    name: 'Sayantan Hait',
    role: 'CGO & Co-Founder',
    note: 'Ex-eSports Manager at Lets Game Now. 7+ Years of experience in the eSports Industry. Hosted Asian Games India Qualifier 2022 (FIFA 22) & 2026 & eISL 2024, GEG 2026.',
    photo: '/founders/sayantan-hait.png',
  },
  {
    name: 'Chaitradip Sarkar',
    role: 'COO & Co-Founder',
    note: 'Ex-STAN, W2 (Hashed Emergent Group), KGeN, Rooter. 7+ years of experience driving growth, GTM, and ecosystem strategy across gaming, esports, and Web3.',
    photo: '/founders/chaitradip-sarkar.png',
  },
] as const;

// const ADVISORS = [
//   {
//     name: 'Arnab Mandal',
//     role: 'Advisor',
//     note: 'Polymath and dynamic versatile leader with 16+ years of rich diverse experience in addition to a world-class education. London Business School — Executive Education, Leadership.',
//     photo: '/founders/Arnab_Mandal.png',
//   },
// ] as const;

export function FoundersSection() {
  return (
    <>
      <motion.section
        id="founders"
        className="section section-founders"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        aria-labelledby="founders-title"
      >
        <PageContainer>
          <div className="section-head section-head--center">
            <h2 id="founders-title">Founding team</h2>
            <p>A decade inside the industry, building Champion Circuit from within.</p>
          </div>
          <div className="founders-grid">
            {FOUNDERS.map((f) => (
              <Card key={f.name} className="founder-card">
                <img className="founder-photo" src={f.photo} alt={f.name} width={112} height={112} loading="lazy" decoding="async" />
                <h3>{f.name}</h3>
                <p className="founder-role">{f.role}</p>
                <p className="founder-note muted small">{f.note}</p>
              </Card>
            ))}
          </div>
        </PageContainer>
      </motion.section>

      {/* <motion.section
        id="advisors"
        className="section section-advisors"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        aria-labelledby="advisors-title"
      >
        <PageContainer>
          <div className="section-head section-head--center">
            <h2 id="advisors-title">Advisors</h2>
            <p>Guided by leader with deep industry expertise.</p>
          </div>
          <div className="cards founders-grid founders-grid--centered">
            {ADVISORS.map((a) => (
              <Card key={a.name} className="founder-card">
                <img className="founder-photo" src={a.photo} alt={a.name} width={112} height={112} loading="lazy" decoding="async" />
                <h3>{a.name}</h3>
                <p className="founder-role">{a.role}</p>
                <p className="founder-note muted small">{a.note}</p>
              </Card>
            ))}
          </div>
        </PageContainer>
      </motion.section> */}
    </>
  );
}
