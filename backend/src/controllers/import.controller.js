const fs = require("fs");
const conversor = require("../../services/conversor");

exports.importReturns = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

  const filePath = req.file.path;
  try {
    const result = await conversor(filePath, req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Erro ao importar histórico:", err);
    res.status(500).json({ error: "Erro ao importar histórico" });
  } finally {
    // o temporário sai mesmo quando a importação falha (senão acumula no disco)
    fs.promises.unlink(filePath).catch(() => {});
  }
};
