const Contact = () => {
  return (
    <div className="page-hero contact-hero">
      <div className="hero-overlay">
        <div className="glass-card">
          <h2 className="section-heading text-white mb-6">Contact Us</h2>
          <form className="contact-form space-y-6">
            <div>
              <label className="block text-white mb-2">Name</label>
              <input type="text" className="form-input" />
            </div>
            <div>
              <label className="block text-white mb-2">Email</label>
              <input type="email" className="form-input" />
            </div>
            <div>
              <label className="block text-white mb-2">Message</label>
              <textarea rows="4" className="form-input"></textarea>
            </div>
            <button className="w-full bg-wave-blue hover:bg-wave-blue/90 text-white py-3 rounded-lg transition">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;
