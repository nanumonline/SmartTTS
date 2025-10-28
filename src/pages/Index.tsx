import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import VoiceGenerator from "@/components/VoiceGenerator";
import ScheduleManager from "@/components/ScheduleManager";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <div id="features">
        <Features />
      </div>
      <div id="generator">
        <VoiceGenerator />
      </div>
      <div id="schedule">
        <ScheduleManager />
      </div>
      <Footer />
    </div>
  );
};

export default Index;
