"use client";
import isEmail from "@/lib/isEmail";
import { ReactNode, SubmitEventHandler, useState } from "react";

const Login = (): ReactNode => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");

  const onSubmit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    try {
      if (!email || !password) {
        throw new Error("Credentials need to be filled in");
      }

      if (!isEmail) {
        throw new Error("Enter valid email");
      }

      const response: Response = await fetch("/api/login", {
        method: "post",
        body: JSON.stringify({
          email,
          password,
        }),
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
    }
  };

  return (
    <div>
      <form onSubmit={onSubmit}>
        <input type="text" />
        <input type="password" />
        <button type="submit">Login</button>
        {
          error ? <span>error</span>:""
        }
      </form>
    </div>
  );
};

export default Login;
