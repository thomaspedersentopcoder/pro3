import clsx from 'clsx';
import { motion } from 'framer-motion';
import React, { FC, ReactNode } from 'react';
import { popIn } from '../animations/popIn';

type SectionTitleProps = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
};

export const SectionTitle: FC<SectionTitleProps> = (props) => {
  return (
    <motion.div
      variants={popIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="text-center"
    >
      <h2
        id={props.id}
        className={clsx(
          'text-2xl font-bold text-black hover:no-underline lg:text-3xl scroll-mt-20 dark:text-white',
        )}
      >
        {props.title}
        <a className="hash-link" href={`#${props.id}`}></a>
      </h2>
      {props.description && (
        <p className="text-zinc-600 dark:text-zinc-300 max-w-[60ch] pt-2 mx-auto text-sm md:text-base">
          {props.description}
        </p>
      )}
    </motion.div>
  );
};
