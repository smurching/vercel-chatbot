import type { ChatMessage } from '@/lib/types';
import type {
  AnchorHTMLAttributes,
  ComponentType,
  PropsWithChildren,
} from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { components } from './elements/streamdown-components/components';

/**
 * ReactMarkdown/Streamdown component that handles Databricks message citations.
 *
 * @example
 * <Streamdown components={{ a: DatabricksMessageCitationStreamdownIntegration }} />
 */
export const DatabricksMessageCitationStreamdownIntegration: ComponentType<
  AnchorHTMLAttributes<HTMLAnchorElement>
> = (props) => {
  console.log('DatabricksMessageCitationStreamdownIntegration', props);
  if (isDatabricksMessageCitationLink(props.href)) {
    return (
      <DatabricksMessageCitationRenderer
        {...props}
        href={decodeDatabricksMessageCitationLink(props.href)}
      />
    );
  }
  return <components.a {...props} />;
};

type SourcePart = Extract<ChatMessage['parts'][number], { type: 'source-url' }>;

// Adds a unique suffix to the link to indicate that it is a Databricks message citation.
const encodeDatabricksMessageCitationLink = (part: SourcePart) =>
  `${part.url}::databricks_citation`;

// Removes the unique suffix from the link to get the original link.
const decodeDatabricksMessageCitationLink = (link: string) =>
  link.replace('::databricks_citation', '');

// Creates a markdown link to the Databricks message citation.
export const createDatabricksMessageCitationMarkdown = (part: SourcePart) =>
  `[${part.title || part.url}](${encodeDatabricksMessageCitationLink(part)})`;

// Checks if the link is a Databricks message citation.
const isDatabricksMessageCitationLink = (
  link?: string,
): link is `${string}::databricks_citation` =>
  link?.endsWith('::databricks_citation') ?? false;

// Renders the Databricks message citation.
const DatabricksMessageCitationRenderer = (
  props: PropsWithChildren<{
    href: string;
  }>,
) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <components.a
          href={props.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-muted-foreground px-2 py-0"
        >
          {props.children}
        </components.a>
      </TooltipTrigger>
      <TooltipContent
        style={{ maxWidth: '300px', padding: '8px', wordWrap: 'break-word' }}
      >
        {props.href}
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * Creates segments of parts that can be rendered as a single component.
 * Used to render citations as part of the associated text.
 */
export const createMessagePartSegments = (parts: ChatMessage['parts']) => {
  // An array of arrays of parts
  // Allows us to render multiple parts as a single component
  const out: ChatMessage['parts'][] = [];
  for (const part of parts) {
    const lastBlock = out[out.length - 1] || null;
    const previousPart = lastBlock?.[lastBlock.length - 1] || null;

    // If the previous part is a text part and the current part is a source part, add it to the current block
    if (previousPart?.type === 'text' && part.type === 'source-url') {
      lastBlock.push(part);
    }
    // If the previous part is a source-url part and the current part is a source part, add it to the current block
    else if (
      previousPart?.type === 'source-url' &&
      part.type === 'source-url'
    ) {
      lastBlock.push(part);
    }
    // Otherwise, add the current part to a new block
    else {
      out.push([part]);
    }
  }

  return out;
};

/**
 * Takes a segment of parts and joins them into a markdown-formatted string.
 * Used to render citations as part of the associated text.
 */
export const joinMessagePartSegments = (parts: ChatMessage['parts']) => {
  return parts.reduce((acc, part) => {
    switch (part.type) {
      case 'text':
        return acc + part.text;
      case 'source-url':
        return `${acc} ${createDatabricksMessageCitationMarkdown(part)}`;
      default:
        return acc;
    }
  }, '');
};
