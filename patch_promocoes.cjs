const fs = require('fs');

let content = fs.readFileSync('src/pages/Promocoes.tsx', 'utf8');

content = content.replace(
  "const [editDescricao, setEditDescricao] = useState('');",
  "const [editDescricao, setEditDescricao] = useState('');\n  const [editMensagemTemplate, setEditMensagemTemplate] = useState('');"
);

content = content.replace(
  `  const handleEdit = (c: Campanha) => {
    setEditingCampanha(c);
    setEditNome(c.nome);
    setEditDescricao(c.descricao || '');
  };`,
  `  const handleEdit = (c: Campanha) => {
    setEditingCampanha(c);
    setEditNome(c.nome);
    setEditDescricao(c.descricao || '');
    setEditMensagemTemplate(c.mensagemTemplate || '');
  };`
);

content = content.replace(
  `      await updateCampanha(editingCampanha.id, { nome: editNome, descricao: editDescricao });`,
  `      await updateCampanha(editingCampanha.id, { nome: editNome, descricao: editDescricao, mensagemTemplate: editMensagemTemplate });`
);

content = content.replace(
  `                  rows={3}
                ></textarea>
              </div>
            </div>`,
  `                  rows={3}
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem (Template)</label>
                <textarea 
                  value={editMensagemTemplate}
                  onChange={(e) => setEditMensagemTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy resize-none"
                  rows={6}
                ></textarea>
              </div>
            </div>`
);

fs.writeFileSync('src/pages/Promocoes.tsx', content);
