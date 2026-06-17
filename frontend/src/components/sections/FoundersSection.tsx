import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { PageContainer } from '../ui/PageContainer';

const FOUNDERS = [
  {
    name: 'Puspul Bag',
    role: 'CEO, Director & Founder',
    note: 'Growth & ecosystem strategy across gaming, esports, and Web3.',
    photo: '/founders/puspul-bag.png',
  },
  {
    name: 'Priyanka Mondal',
    role: 'CDO, Co-Founder & Director',
    note: '10+ years in esports; represented India in eFIBA Seasons 1 & 2.',
    photo: '/founders/priyanka-mondal.png',
  },
  {
    name: 'Sayantan Hait',
    role: 'CGO & Co-Founder',
    note: 'Asian Games India Qualifier FIFA 2022 & eISL 2024 operations.',
    photo: '/founders/sayantan-hait.png',
  },
  {
    name: 'Chaitradip Sarkar',
    role: 'COO & Co-Founder',
    note: '7+ years hosting qualifiers and league-scale esports events.',
    photo: '/founders/chaitradip-sarkar.png',
  },
] as const;

export function FoundersSection() {
  return (
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
        <div className="cards founders-grid">
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
  );
}
