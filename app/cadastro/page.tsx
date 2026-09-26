"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Cadastro() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");

  async function cadastrar() {
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Cadastro criado com sucesso!");
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div>
        <h1 className="text-2xl mb-4">
          Criar conta
        </h1>

        <input
          className="border p-2 block mb-2"
          placeholder="Email"
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          className="border p-2 block mb-2"
          placeholder="Senha"
          type="password"
          onChange={(e)=>setSenha(e.target.value)}
        />

        <button
          className="bg-cyan-500 p-2"
          onClick={cadastrar}
        >
          Criar conta
        </button>

        <p>{msg}</p>
      </div>
    </main>
  );
}
