import React, { useState, useEffect } from 'react';

const MylSorter = () => {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const res = await fetch('https://api.carpetazo.cl/api/admin/myl-sorter');
        const data = await res.json();
        if (data.success) {
          setCards(data.data);
          
          // Load progress from localStorage
          const savedIndex = localStorage.getItem('myl_sorter_index');
          if (savedIndex) {
            setCurrentIndex(parseInt(savedIndex, 10));
          }
        }
      } catch (error) {
        console.error('Error fetching cards:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, []);

  const handleSort = async (targetGroupName) => {
    if (saving) return;
    setSaving(true);
    const currentCard = cards[currentIndex];
    
    try {
      const res = await fetch('https://api.carpetazo.cl/api/admin/myl-sorter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: currentCard.id, targetGroupName })
      });
      const data = await res.json();
      
      if (data.success) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        localStorage.setItem('myl_sorter_index', nextIndex.toString());
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  const skipCard = () => {
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    localStorage.setItem('myl_sorter_index', nextIndex.toString());
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white text-2xl font-bold">Cargando cartas...</div>;
  
  if (currentIndex >= cards.length) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-green-400 text-4xl font-bold">¡Has terminado de clasificar todas las cartas!</div>;
  }

  const card = cards[currentIndex];
  
  // Custom buttons the user requested
  const buttons = [
    { label: 'Espada Sagrada', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Helenica', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Hijos de Daana', color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Dominios de RA', color: 'bg-yellow-600 hover:bg-yellow-700 text-yellow-50' },
    { label: 'Dracula Inferno', color: 'bg-red-600 hover:bg-red-700' }
  ];

  return (
    <div className="min-h-[100dvh] bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-full font-bold shadow-lg">
        Progreso: {currentIndex + 1} / {cards.length}
      </div>

      <div className="max-w-4xl w-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
        
        {/* Left Side Buttons (2 buttons) */}
        <div className="flex flex-row md:flex-col gap-4 w-full md:w-auto justify-center">
          {buttons.slice(0, 2).map((btn) => (
            <button 
              key={btn.label}
              onClick={() => handleSort(btn.label)}
              disabled={saving}
              className={`${btn.color} text-white font-bold py-4 px-6 md:px-8 rounded-xl shadow-xl transform transition hover:scale-105 active:scale-95 text-lg md:text-xl w-full md:w-64`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Center Card */}
        <div className="flex flex-col items-center">
          <h2 className="text-white text-2xl md:text-3xl font-black mb-6 text-center max-w-sm drop-shadow-md">
            {card.name}
            <span className="block text-sm font-normal text-gray-400 mt-2">Edición Actual: {card.group?.name || 'Desconocida'}</span>
          </h2>
          
          <div className="relative group perspective">
            <img 
              src={card.imageUrl} 
              alt={card.name}
              className="w-64 md:w-80 h-auto rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-2 border-gray-700 transform transition-transform duration-500 group-hover:scale-105"
            />
            {saving && (
              <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
              </div>
            )}
          </div>
          
          <button onClick={skipCard} className="mt-8 text-gray-400 hover:text-white underline font-medium">
            Omitir carta (no modificar)
          </button>
        </div>

        {/* Right Side Buttons (3 buttons) */}
        <div className="flex flex-col gap-4 w-full md:w-auto justify-center">
          {buttons.slice(2, 5).map((btn) => (
            <button 
              key={btn.label}
              onClick={() => handleSort(btn.label)}
              disabled={saving}
              className={`${btn.color} text-white font-bold py-4 px-6 md:px-8 rounded-xl shadow-xl transform transition hover:scale-105 active:scale-95 text-lg md:text-xl w-full md:w-64`}
            >
              {btn.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
};

export default MylSorter;
