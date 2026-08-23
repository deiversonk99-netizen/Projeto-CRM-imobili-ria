const fs = require('fs');
let content = fs.readFileSync('src/pages/Promocoes.tsx', 'utf8');

if (!content.includes('editFiltrosJson')) {
  content = content.replace(
    "const [editMensagemTemplate, setEditMensagemTemplate] = useState('');",
    "const [editMensagemTemplate, setEditMensagemTemplate] = useState('');\n  const [editFiltrosJson, setEditFiltrosJson] = useState('');"
  );
  
  content = content.replace(
    "setEditMensagemTemplate(c.mensagemTemplate || '');",
    "setEditMensagemTemplate(c.mensagemTemplate || '');\n    setEditFiltrosJson(c.filtrosJson || '{}');"
  );

  content = content.replace(
    "await updateCampanha(editingCampanha.id, { nome: editNome, descricao: editDescricao, mensagemTemplate: editMensagemTemplate });",
    "await updateCampanha(editingCampanha.id, { nome: editNome, descricao: editDescricao, mensagemTemplate: editMensagemTemplate, filtrosJson: editFiltrosJson });"
  );

  content = content.replace(
    `                  rows={6}
                ></textarea>
              </div>
            </div>`,
    `                  rows={6}
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Filtros (JSON)</label>
                <textarea 
                  value={editFiltrosJson}
                  onChange={(e) => setEditFiltrosJson(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy resize-none font-mono text-xs"
                  rows={4}
                ></textarea>
              </div>
            </div>`
  );
  
  fs.writeFileSync('src/pages/Promocoes.tsx', content);
}
