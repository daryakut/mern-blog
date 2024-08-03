import React from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function Post({
  title,
  summary,
  cover,
  content,
  createdAt,
  author,
  _id,
}) {
  console.log("Post data:", {
    title,
    summary,
    cover,
    content,
    createdAt,
    author,
  });

  return (
    <div className="post">
      <div className="image">
        <Link to={`/post/${_id}`}>
          {cover ? (
            <img
              src={`http://localhost:4000/uploads/${cover}`}
              alt="Post cover"
            />
          ) : (
            <img
              src="https://scienceblog.com/wp-content/uploads/2023/09/El-Gordo.jpg"
              alt="Default cover"
            />
          )}
        </Link>
      </div>

      <div className="texts">
        <Link to={`/post/${_id}`}>
          <h2>{title}</h2>
        </Link>
        <p className="info">
          <a className="author">{author?.userName || "Unknown"}</a>
          <time>{format(new Date(createdAt), "dd-MM-yyyy HH:mm")}</time>
        </p>
        <p className="summary">{summary}</p>
      </div>
    </div>
  );
}
