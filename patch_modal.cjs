const fs = require('fs');

let content = fs.readFileSync('src/pages/Promocoes.tsx', 'utf8');

// add state for delete confirmation
content = content.replace(
  "const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);",
  "const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);\n  const [deletingCampanha, setDeletingCampanha] = useState<Campanha | null>(null);"
);

// update handleDelete to just set the state
content = content.replace(
  `  const handleDelete = async (id: string, nome: string) => {
    if (window.confirm(\`Tem certeza que deseja excluir a campanha "\${nome}"?\`)) {
      try {
        await deleteCampanha(id);
      } catch (err) {
        alert('Erro ao excluir campanha.');
      }
    }
  };`,
  `  const handleDelete = (c: Campanha) => {
    setDeletingCampanha(c);
  };
  
  const confirmDelete = async () => {
    if (!deletingCampanha) return;
    try {
      await deleteCampanha(deletingCampanha.id);
      setDeletingCampanha(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir campanha.');
    }
  };`
);

// update the button onClick
content = content.replace(
  "onClick={() => handleDelete(c.id, c.nome)}",
  "onClick={() => handleDelete(c)}"
);

// append the modal HTML right before the final closing div
const modalHtml = `
      {deletingCampanha && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Excluir Campanha</h2>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir a campanha <strong className="text-slate-800">"{deletingCampanha.nome}"</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setDeletingCampanha(null)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-1"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors flex-1"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}`;

content = content.replace(
  "      {editingCampanha && (",
  modalHtml + "\n      {editingCampanha && ("
);

fs.writeFileSync('src/pages/Promocoes.tsx', content);
